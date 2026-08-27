export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { sendMatchAlertEmail } from '@/lib/email';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';
import { Events } from '@/lib/events';
import {
  calculateMatchScore as calculateMatchScoreBase,
  expandCategoryGroup,
  classifyStage2,
  semanticMatchScore,
  STAGE3_SEMANTIC_ACCEPT_THRESHOLD,
} from '@/lib/matching';

const MAX_RADIUS_KM = 50;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (sinônimos + score de descrição), só sem a
// lógica duplicada localmente. Ver comentário completo no módulo. Usado só
// como score de EXIBIÇÃO (coluna score da tabela matches) — a decisão de
// criar match ou não vem do funil em estágios (classifyStage2), não mais
// de score >= threshold (27/08/2026, ver src/lib/matching.ts).
function calculateMatchScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate, { synonyms: true, description: true });
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
      const score = calculateMatchScore(object, candidate); // só exibição (coluna score)

      // Funil em estágios (27/08/2026, ver src/lib/matching.ts): overlap de
      // texto real é obrigatório pra sobreviver o estágio 2 (elimina antes
      // de qualquer confiança); confiança (distância+cor, sem categoria) só
      // decide DIRETO vs AMBÍGUO entre quem já sobreviveu.
      const stage2 = classifyStage2(
        object,
        candidate,
        { synonyms: true, description: true }, // overlapOptions — igual ao caminho individual de sempre
        { brand: false } // confidenceOptions — individual não coleta marca hoje
      );

      if (stage2.decision === 'direct') {
        await processMatch(object, candidate, score, objectId, payload.sub, matches);
      } else if (stage2.decision === 'ambiguous') {
        // Estágio 3 (LLM) — assíncrono em paralelo, mesmo padrão de antes
        const checkPromise = (async () => {
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= STAGE3_SEMANTIC_ACCEPT_THRESHOLD) {
            const finalScore = Math.round((score + aiScore) / 2);
            await processMatch(object, candidate, finalScore, objectId, payload.sub, matches);
          }
        })();
        semanticChecks.push(checkPromise);
      }
      // 'eliminated' → descarta silenciosamente
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
