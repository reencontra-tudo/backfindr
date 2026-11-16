export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { sendMatchAlertEmail } from '@/lib/email';
import { tituloPublico } from '@/lib/objectPublicView';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';
import { awaitSends, sendWaitBudget } from '@/lib/awaitSends';
import { buscarDonoParaAviso } from '@/lib/matchingSeguranca';
import { montarBuscaDeCandidatos, parPodeVirarMatch, papeisDoPar, statusDosCandidatos } from '@/lib/matchingFiltro';
import { Events, recordEvent } from '@/lib/events';
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

    const lat = parseFloat(object.latitude);
    const lon = parseFloat(object.longitude);
    const hasLocation = !isNaN(lat) && !isNaN(lon);

    // Busca candidatos pelo filtro central (src/lib/matchingFiltro.ts): status oposto, mesma categoria, raio, não legados (objeto e dono)
    // e ordem das datas da OCORRÊNCIA. Esta rota continua não dependendo do interruptor nem do corte de objetos novos.
    // animal/pet são o mesmo conceito com nome diferente por herança do legado (expandCategoryGroup).
    const categoryGroup = object.category ? expandCategoryGroup(object.category as string) : null;
    const busca = montarBuscaDeCandidatos(object, {
      statuses: statusDosCandidatos(object.status),
      categoryGroup,
      maxRadiusKm: MAX_RADIUS_KM,
      ordem: 'distancia',
      limiteComCoordenada: 200,
      limiteSemCoordenada: 100,
      semCategoriaSemCoordenada: 'buscar',
    });

    // Perdido e roubado procuram achados; achado procura perdidos e roubados. Status fora disso não participa: sem candidatos.
    const candidatesResult = busca ? await query(busca.sql, busca.params) : { rows: [] as Record<string, unknown>[] };

    // ── Loop de matching em duas camadas ──────────────────────────────────
    const matches: Record<string, unknown>[] = [];
    const semanticChecks: Promise<void>[] = [];
    const pendingSends: Promise<unknown>[] = [];
    const startedAtMs = Date.now();

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
        await processMatch(object, candidate, score, objectId, payload.sub, matches, pendingSends);
      } else if (stage2.decision === 'ambiguous') {
        // Estágio 3 (LLM) — assíncrono em paralelo, mesmo padrão de antes
        const checkPromise = (async () => {
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= STAGE3_SEMANTIC_ACCEPT_THRESHOLD) {
            const finalScore = Math.round((score + aiScore) / 2);
            await processMatch(object, candidate, finalScore, objectId, payload.sub, matches, pendingSends);
          }
        })();
        semanticChecks.push(checkPromise);
      }
      // 'eliminated' → descarta silenciosamente
    }

    // Aguarda todas as validações semânticas
    await Promise.allSettled(semanticChecks);

    // Espera os envios (e-mail/push) já iniciados antes de responder
    await awaitSends(pendingSends, sendWaitBudget(startedAtMs, 25_000));

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
  matches: Record<string, unknown>[],
  pendingSends: Promise<unknown>[]
) {
  // Último ponto antes de gravar: par fora da ordem das datas da ocorrência nunca vira match, nem pendente.
  if (!parPodeVirarMatch(object, candidate)) return;

  // Evita duplicata
  const existingMatch = await query(
    `SELECT id FROM matches
     WHERE (lost_object_id = $1 AND found_object_id = $2)
        OR (lost_object_id = $2 AND found_object_id = $1)`,
    [objectId, candidate.id]
  );
  if (existingMatch.rows.length > 0) return;

  // O «perdido» do par é sempre o objeto lost ou stolen e o «achado» é sempre o found, qualquer que seja o objeto que disparou.
  const papeis = papeisDoPar(object, candidate);
  if (!papeis) return;
  const lostId = papeis.perdido.id;
  const foundId = papeis.achado.id;

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

  // Notificações (as promessas vão para pendingSends e são aguardadas pela rota)
  try {
    const lostObj = papeis.perdido;
    const foundObj = papeis.achado;

    const ownerRow = await buscarDonoParaAviso(lostObj.id as string);

    // Conta de sistema (sinais públicos) não é pessoa: sem e-mail, push nem evento «dono notificado». O match continua gravado.
    if (ownerRow && !ownerRow.is_system_account) {
      const owner = ownerRow;

      // Barreira de proteção: objeto ou dono legado nunca recebe e-mail nem push.
      if (!owner.legacy_blocked) {
        pendingSends.push(
          sendMatchAlertEmail(
            { name: owner.name, email: owner.email },
            tituloPublico(lostObj.title as string, lostObj.source as string | null) as string,
            newMatch.id,
            score,
            tituloPublico(foundObj.title as string, foundObj.source as string | null) as string   // sinal público: nome mascarado no e-mail
          ).catch(err => console.error('[matching] Falha ao enviar e-mail de match:', err))
        );

        // O push vai para o dono do objeto perdido (antes, como o id do dono
        // não vinha na consulta, ia para quem disparou o matching).
        pendingSends.push(
          sendPushToUser(
            owner.id as string,
            matchPayload(newMatch.id as string, lostObj.title as string, score),
            { event: 'match' }
          ).catch(err => console.error('[push] match push failed:', err))
        );
      }

      // ── Evento: dono notificado ─────────────────────────────────────────
      // Gravado exatamente como antes (sem user_id), para não mudar o que já é registrado.
      recordEvent({
        object_id: lostObj.id as string,
        type: 'owner_notified',
        title: 'Dono notificado',
        source: 'system',
      }).catch(() => {});
    }
  } catch (emailErr) {
    console.error('[matching] Erro ao buscar dono para notificação:', emailErr);
  }
}
