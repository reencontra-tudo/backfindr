export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { sendMatchAlertEmail } from '@/lib/email';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';
import { Events } from '@/lib/events';
import { calculateMatchScore as calculateMatchScoreBase, expandCategoryGroup, hasTextOverlap } from '@/lib/matching';

const MAX_RADIUS_KM = 50;

// ─── Threshold de score ────────────────────────────────────────────────────
// >= 40  → match direto (sem IA)
// 20–39  → envia para validação semântica via Claude
// < 20   → descarta
const SCORE_DIRECT_MATCH = 40;
const SCORE_SEMANTIC_MIN = 20;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (sinônimos + score de descrição), só sem a
// lógica duplicada localmente. Ver comentário completo no módulo.
function calculateMatchScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate, { synonyms: true, description: true });
}

// ─── Validação semântica via Claude (camada 2) ────────────────────────────
async function semanticMatchScore(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>
): Promise<number> {
  try {
    const prompt = `Você é um especialista em recuperação de objetos perdidos.
Avalie se os dois objetos abaixo provavelmente são o mesmo objeto.

OBJETO A (${obj.status === 'lost' ? 'PERDIDO' : 'ACHADO'}):
Título: ${obj.title}
Descrição: ${obj.description || '(sem descrição)'}
Cor: ${obj.color || '(não informada)'}
Categoria: ${obj.category || obj.type || '(não informada)'}

OBJETO B (${candidate.status === 'lost' ? 'PERDIDO' : 'ACHADO'}):
Título: ${candidate.title}
Descrição: ${candidate.description || '(sem descrição)'}
Cor: ${candidate.color || '(não informada)'}
Categoria: ${candidate.category || candidate.type || '(não informada)'}

Responda APENAS com um JSON no formato:
{"score": <número de 0 a 100>, "reason": "<explicação em uma frase>"}

Onde score representa a probabilidade de serem o mesmo objeto:
0-20: improvável | 21-50: possível | 51-80: provável | 81-100: quase certeza`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // modelo mais rápido e barato
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return 0;

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return typeof parsed.score === 'number' ? parsed.score : 0;
  } catch {
    console.error('[matching] Erro na validação semântica');
    return 0; // falha silenciosa — não bloqueia o fluxo
  }
}

// ─── POST /api/v1/matching/run ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();
    const { objectId } = body;
    if (!objectId) return successResponse({ detail: 'objectId is required' }, 400);

    // Busca o objeto base
    const objectResult = await query(
      'SELECT * FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );
    if (objectResult.rows.length === 0)
      return successResponse({ detail: 'Object not found' }, 404);

    const object = objectResult.rows[0];

    // Objetos protegidos (QR preventivo) não participam do matching —
    // eles só são ativados quando alguém escaneia o QR fisicamente.
    if (object.status === 'protected') {
      return successResponse({ detail: 'Protected objects do not participate in matching', matches: 0 });
    }

    // ── Evento: matching iniciado ─────────────────────────────────────────
    Events.matchingStarted(objectId).catch(() => {});

    const oppositeStatus = object.status === 'lost' ? 'found' : 'lost';
    const lat = parseFloat(object.latitude);
    const lon = parseFloat(object.longitude);
    const hasLocation = !isNaN(lat) && !isNaN(lon);

    // ── Busca candidatos ──────────────────────────────────────────────────
    let candidateQuery: string;
    let candidateParams: unknown[];

    // Categoria virou filtro obrigatório na busca (26/08/2026) — antes só
    // pesava no score (+30), o que deixava electronics↔other, vehicle↔other
    // etc. virarem candidatos e baterem o threshold só com distância +
    // sobreposição de palavras. Sem category, nenhum filtro de categoria é
    // aplicado (mesmo comportamento de antes pra objetos sem categoria).
    // animal/pet são o mesmo conceito com nome diferente por herança do
    // legado (26/08/2026) — expandCategoryGroup trata como sinônimo pra não
    // travar um cão 'animal' de casar com um cão 'pet'.
    const categoryGroup = object.category ? expandCategoryGroup(object.category as string) : null;
    const categoryFilter = categoryGroup ? 'AND (category = ANY($6) OR type = ANY($6))' : '';

    // is_legacy = false exclui os registros migrados do Webjetos (26/08/2026)
    // — 93% da base de objetos ativos hoje é desse legado (2014-2016), com
    // título/descrição genéricos demais ("CACHORRO DESAPARECIDO" x2) pra
    // matching automático fazer sentido. As 43 matches do diagnóstico eram
    // 100% webjetos×webjetos. Não afeta o próprio objeto sendo buscado
    // (esse já foi lido antes, filtro só se aplica aos candidatos).
    if (hasLocation) {
      candidateQuery = `
        SELECT *,
          (6371 * acos(LEAST(1.0,
            cos(radians($3)) * cos(radians(latitude::float)) *
            cos(radians(longitude::float) - radians($4)) +
            sin(radians($3)) * sin(radians(latitude::float))
          ))) AS distance_km
        FROM objects
        WHERE status = $1
          AND id != $2
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            6371 * acos(LEAST(1.0,
              cos(radians($3)) * cos(radians(latitude::float)) *
              cos(radians(longitude::float) - radians($4)) +
              sin(radians($3)) * sin(radians(latitude::float))
            ))
          ) <= $5
          AND is_legacy = false
          ${categoryFilter}
        ORDER BY distance_km ASC
        LIMIT 200
      `;
      candidateParams = categoryGroup
        ? [oppositeStatus, objectId, lat, lon, MAX_RADIUS_KM, categoryGroup]
        : [oppositeStatus, objectId, lat, lon, MAX_RADIUS_KM];
    } else if (categoryGroup) {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
          AND is_legacy = false
          AND (category = ANY($3) OR type = ANY($3))
        ORDER BY created_at DESC LIMIT 100
      `;
      candidateParams = [oppositeStatus, objectId, categoryGroup];
    } else {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
          AND is_legacy = false
        ORDER BY created_at DESC LIMIT 100
      `;
      candidateParams = [oppositeStatus, objectId];
    }

    const candidatesResult = await query(candidateQuery, candidateParams);

    // ── Loop de matching em duas camadas ──────────────────────────────────
    const matches: Record<string, unknown>[] = [];
    const semanticChecks: Promise<void>[] = [];

    for (const candidate of candidatesResult.rows) {
      const score = calculateMatchScore(object, candidate);

      // categoria+distância sozinhas não bastam mais pra criar match direto
      // (26/08/2026) — 42% das matches do diagnóstico eram exatamente isso,
      // score=45, zero palavra em comum. A camada semântica (abaixo) já tem
      // sua própria validação independente (IA ≥60), não precisa do gate.
      if (score >= SCORE_DIRECT_MATCH && hasTextOverlap(object, candidate, { synonyms: true, description: true })) {
        // Camada 1: match direto por heurística
        await processMatch(object, candidate, score, objectId, payload.sub, matches);
      } else if (score >= SCORE_SEMANTIC_MIN) {
        // Camada 2: validação semântica via Claude (assíncrona em paralelo)
        const checkPromise = (async () => {
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= 60) {
            // Claude confirmou — usa a média dos dois scores
            const finalScore = Math.round((score + aiScore) / 2);
            await processMatch(object, candidate, finalScore, objectId, payload.sub, matches);
          }
        })();
        semanticChecks.push(checkPromise);
      }
      // score < SCORE_SEMANTIC_MIN → descarta silenciosamente
    }

    // Aguarda todas as validações semânticas
    await Promise.allSettled(semanticChecks);

    // ── Evento: matching concluído ────────────────────────────────────────
    Events.matchingCompleted(objectId, candidatesResult.rows.length).catch(() => {});

    return successResponse({
      message: `Matching concluído. ${matches.length} match(es) encontrado(s).`,
      matches,
      candidates_checked: candidatesResult.rows.length,
      semantic_checks: semanticChecks.length,
      search_radius_km: hasLocation ? MAX_RADIUS_KM : null,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// ─── Helper: persiste match e envia notificações ───────────────────────────
async function processMatch(
  object: Record<string, unknown>,
  candidate: Record<string, unknown>,
  score: number,
  objectId: string,
  userId: unknown,
  matches: Record<string, unknown>[]
) {
  // Evita duplicata
  const existingMatch = await query(
    `SELECT id FROM matches
     WHERE (lost_object_id = $1 AND found_object_id = $2)
        OR (lost_object_id = $2 AND found_object_id = $1)`,
    [objectId, candidate.id]
  );
  if (existingMatch.rows.length > 0) return;

  const lostId = object.status === 'lost' ? objectId : candidate.id;
  const foundId = object.status === 'found' ? objectId : candidate.id;

  const matchResult = await query(
    `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', NOW(), NOW())
     RETURNING *`,
    [lostId, foundId, score]
  );

  const newMatch = matchResult.rows[0];
  matches.push(newMatch);

  // ── Evento: match encontrado ──────────────────────────────────────────
  Events.matchFound(objectId, newMatch.id as string, score).catch(() => {});

  // Notificações (fire-and-forget)
  try {
    const lostObj = object.status === 'lost' ? object : candidate;
    const foundObj = object.status === 'found' ? object : candidate;

    const ownerResult = await query(
      `SELECT u.name, u.email FROM users u
       JOIN objects o ON o.user_id = u.id
       WHERE o.id = $1`,
      [lostObj.id]
    );

    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0];

      sendMatchAlertEmail(
        { name: owner.name, email: owner.email },
        lostObj.title as string,
        newMatch.id,
        score,
        foundObj.title as string
      ).catch(err => console.error('[matching] Falha ao enviar e-mail de match:', err));

      sendPushToUser(
        owner.id as string ?? (userId as string),
        matchPayload(newMatch.id as string, lostObj.title as string, score)
      ).catch(err => console.error('[push] match push failed:', err));

      // ── Evento: dono notificado ─────────────────────────────────────────
      Events.ownerNotified(lostObj.id as string, owner.id as string).catch(() => {});
    }
  } catch (emailErr) {
    console.error('[matching] Erro ao buscar dono para notificação:', emailErr);
  }
}
