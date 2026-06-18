export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { sendMatchAlertEmail } from '@/lib/email';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';

const MAX_RADIUS_KM = 50;

// ─── Threshold de score ────────────────────────────────────────────────────
// >= 40  → match direto (sem IA)
// 20–39  → envia para validação semântica via Claude
// < 20   → descarta
const SCORE_DIRECT_MATCH = 40;
const SCORE_SEMANTIC_MIN = 20;

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
const SINONIMOS: Record<string, string[]> = {
  bolsa: ['mochila', 'sacola', 'bag', 'pochete', 'carteira', 'maleta', 'pasta'],
  mochila: ['bolsa', 'sacola', 'bag', 'morral', 'saco'],
  sacola: ['bolsa', 'mochila', 'bag', 'saco'],
  celular: ['telefone', 'smartphone', 'iphone', 'android', 'aparelho', 'samsung', 'motorola'],
  telefone: ['celular', 'smartphone', 'aparelho'],
  carteira: ['wallet', 'bolsa', 'porta-documentos', 'porta documentos'],
  chave: ['chaves', 'chaveiro', 'key'],
  oculos: ['lentes', 'armacao', 'grau', 'sol'],
  notebook: ['computador', 'laptop', 'note', 'mac', 'macbook'],
  computador: ['notebook', 'laptop', 'pc', 'desktop'],
  caderno: ['cadernos', 'agenda', 'livro', 'bloco', 'diario'],
  agenda: ['caderno', 'livro', 'bloco', 'diario'],
  cachorro: ['cao', 'dog', 'pet', 'animal', 'canino'],
  cao: ['cachorro', 'dog', 'pet', 'animal'],
  gato: ['cat', 'felino', 'pet', 'animal', 'gatinho'],
  relogio: ['watch', 'smartwatch', 'cronometro'],
  documento: ['documentos', 'rg', 'cpf', 'identidade', 'passaporte', 'habilitacao', 'cnh'],
  identidade: ['rg', 'documento', 'cpf', 'passaporte'],
  onibus: ['bus', 'coletivo', 'transporte'],
  trem: ['metro', 'metrô', 'subway'],
  tablet: ['ipad', 'kindle', 'leitor'],
  fone: ['fones', 'headphone', 'earphone', 'airpod', 'auricular', 'headset'],
  headphone: ['fone', 'fones', 'earphone', 'airpod', 'auricular'],
};

// ─── Normalização de texto ──────────────────────────────────────────────────
function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  // Remove plural simples: 's' final em palavras com mais de 4 letras
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

function tokenizar(text: string): string[] {
  return removerAcentos(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function expandirTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const norm = normalizarPalavra(token);
    expanded.add(norm);
    const sinonimos = SINONIMOS[norm] || [];
    for (const s of sinonimos) expanded.add(normalizarPalavra(s));
  }
  return expanded;
}

// ─── Cálculo de distância (Haversine) ──────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Score heurístico (Fix 2: sinônimos + normalização) ────────────────────
function calculateMatchScore(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>
): number {
  let score = 0;

  // Categoria (+30)
  const objCat = obj.category || obj.type;
  const canCat = candidate.category || candidate.type;
  if (objCat && canCat && objCat === canCat) score += 30;

  // Distância geográfica
  const lat1 = parseFloat(obj.latitude as string);
  const lon1 = parseFloat(obj.longitude as string);
  const lat2 = parseFloat(candidate.latitude as string);
  const lon2 = parseFloat(candidate.longitude as string);
  if (!isNaN(lat1) && !isNaN(lat2)) {
    const distKm = haversineKm(lat1, lon1, lat2, lon2);
    if (distKm <= 2)       score += 40;
    else if (distKm <= 10) score += 30;
    else if (distKm <= 25) score += 15;
    else if (distKm <= 50) score += 5;
  } else {
    score += 15; // sem localização, benefício da dúvida
  }

  // Título — com sinônimos (+7 por palavra em comum, até 20 pts)
  if (obj.title && candidate.title) {
    const w1 = expandirTokens(tokenizar(obj.title as string));
    const w2 = expandirTokens(tokenizar(candidate.title as string));
    const common = [...w1].filter(w => w2.has(w)).length;
    if (common > 0) score += Math.min(20, common * 7);
  }

  // Descrição — com sinônimos (até 10 pts)
  if (obj.description && candidate.description) {
    const w1 = tokenizar(obj.description as string);
    const w2 = expandirTokens(tokenizar(candidate.description as string));
    const w1Expanded = expandirTokens(w1);
    const common = [...w1Expanded].filter(w => w2.has(w)).length;
    score += Math.min(10, (common / Math.max(w1.length, 1)) * 10);
  }

  // Cor (+10 se coincidir)
  if (obj.color && candidate.color) {
    const c1 = normalizarPalavra(obj.color as string);
    const c2 = normalizarPalavra(candidate.color as string);
    if (c1 === c2) score += 10;
  }

  return Math.min(100, Math.round(score));
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

    const oppositeStatus = object.status === 'lost' ? 'found' : 'lost';
    const lat = parseFloat(object.latitude);
    const lon = parseFloat(object.longitude);
    const hasLocation = !isNaN(lat) && !isNaN(lon);

    // ── Busca candidatos ──────────────────────────────────────────────────
    let candidateQuery: string;
    let candidateParams: unknown[];

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
        ORDER BY distance_km ASC
        LIMIT 200
      `;
      candidateParams = [oppositeStatus, objectId, lat, lon, MAX_RADIUS_KM];
    } else if (object.category) {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
          AND (category = $3 OR type = $3)
        ORDER BY created_at DESC LIMIT 100
      `;
      candidateParams = [oppositeStatus, objectId, object.category];
    } else {
      candidateQuery = `
        SELECT * FROM objects
        WHERE status = $1 AND id != $2
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

      if (score >= SCORE_DIRECT_MATCH) {
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
    }
  } catch (emailErr) {
    console.error('[matching] Erro ao buscar dono para notificação:', emailErr);
  }
}
