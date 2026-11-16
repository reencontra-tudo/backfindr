export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Events } from '@/lib/events';
import { sendMatchAlertEmail } from '@/lib/email';
import { tituloPublico } from '@/lib/objectPublicView';
import { sendPushToUser, matchPayload } from '@/lib/pushNotification';
import { awaitSends, sendWaitBudget } from '@/lib/awaitSends';
import { MATCHING_ATIVO, buscarDonoParaAviso, donoPodeSerAvisado } from '@/lib/matchingSeguranca';
import { comMarca } from '@/lib/rotinaMarca';
import { buscarGatilhosNovos, montarBuscaDeCandidatos, parPodeVirarMatch, papeisDoPar, statusDosCandidatos } from '@/lib/matchingFiltro';
import {
  calculateMatchScore as calculateMatchScoreBase,
  expandCategoryGroup,
  classifyStage2,
  semanticMatchScore,
  STAGE3_SEMANTIC_ACCEPT_THRESHOLD,
} from '@/lib/matching';

const MAX_RADIUS_KM = 50;
const CRON_INTERVAL_MINUTES = 15;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (sem sinônimo/descrição/marca), só sem a
// lógica duplicada localmente. Ver comentário completo no módulo.
function calculateScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate);
}

// GET — chamado pelo Vercel Cron
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed (25/08/2026, rotação do CRON_SECRET): o fallback hardcoded
  // 'backfindr-cron-secret' era público no código-fonte — qualquer deploy
  // sem CRON_SECRET configurado ficava protegido só por uma string
  // conhecida. Sem CRON_SECRET, a rota recusa qualquer chamada.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Segredo conferido: daqui em diante a chamada deixa uma marca de vida (src/lib/rotinaMarca.ts). A marca nunca muda a resposta.
  return comMarca('matching', () => executar());
}

async function executar(): Promise<NextResponse> {
  // Interruptor (MATCHING_ATIVO=1): desligado, a rota responde sem processar nada e sem nenhum efeito colateral
  // (sem consulta de objetos, sem match, sem e-mail, sem push, sem evento).
  if (!MATCHING_ATIVO()) {
    return NextResponse.json({
      ok: true,
      ativo: false,
      message: 'Matching automático desligado (MATCHING_ATIVO). Nada foi processado.',
      objects_processed: 0,
      matches_created: 0,
    });
  }

  const startedAt = new Date();
  let totalMatches = 0;
  let totalObjects = 0;

  try {
    // Gatilhos (regra A): só objetos NOVOS (cadastrados depois do corte de reativação do matching), de usuário não legado, perdidos, roubados ou achados,
    // que ainda NÃO foram processados (sem evento matching_completed). Os mais antigos primeiro. Um objeto processado não volta a ser gatilho.
    // A regra «par já avaliado, em qualquer status, não volta» continua valendo abaixo.
    const objects = await buscarGatilhosNovos(100);

    totalObjects = objects.length;
    const pendingSends: Promise<unknown>[] = [];

    for (const object of objects) {
      // ── Evento: matching iniciado ───────────────────────────────────
      Events.matchingStarted(object.id as string).catch(() => {});

      // Categoria é filtro obrigatório; animal/pet são o mesmo conceito (ver expandCategoryGroup).
      const categoryGroup = object.category ? expandCategoryGroup(object.category as string) : null;

      // Candidatos: status oposto, não legados (objeto e dono), mesma categoria, até 50 km, e ordem das datas da OCORRÊNCIA (regra C) — tudo no filtro central.
      const busca = montarBuscaDeCandidatos(object, {
        statuses: statusDosCandidatos(object.status),
        categoryGroup,
        maxRadiusKm: MAX_RADIUS_KM,
        ordem: 'criacao',
        limiteComCoordenada: 100,
        limiteSemCoordenada: 50,
        semCategoriaSemCoordenada: 'pular',
      });
      if (!busca) {
        await Events.matchingCompleted(object.id as string, 0); // marcador de «objeto já processado»: gravado antes de seguir
        continue;
      }

      const candidates = await query(busca.sql, busca.params);

      for (const candidate of candidates.rows) {
        const score = calculateScore(object, candidate); // só exibição (coluna score)

        // Funil em estágios (ver src/lib/matching.ts): a ordem das datas da ocorrência elimina primeiro; depois overlap de texto; depois confiança.
        const stage2 = classifyStage2(object, candidate);

        let finalScore: number | null = null;
        if (stage2.decision === 'direct') {
          finalScore = score;
        } else if (stage2.decision === 'ambiguous') {
          // Estágio 3 (não alterado): sem chave ele devolve 0 e o par é descartado.
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= STAGE3_SEMANTIC_ACCEPT_THRESHOLD) {
            finalScore = Math.round((score + aiScore) / 2);
          }
        }
        if (finalScore === null) continue; // eliminado, ou ambíguo rejeitado pela IA

        // Último ponto antes de gravar: par fora da ordem das datas nunca vira match, nem pendente.
        if (!parPodeVirarMatch(object, candidate)) continue;

        // Quem é o perdido (lost ou stolen) e quem é o achado (found): sempre pelo status, qualquer que seja o gatilho.
        const papeis = papeisDoPar(object, candidate);
        if (!papeis) continue;
        const lostObj = papeis.perdido;
        const foundObj = papeis.achado;

        const existing = await query(
          `SELECT id FROM matches
           WHERE (lost_object_id = $1 AND found_object_id = $2)
              OR (lost_object_id = $2 AND found_object_id = $1)`,
          [lostObj.id, foundObj.id]
        );
        if (existing.rows.length > 0) continue;

        const matchResult = await query(
          `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), NOW())
           RETURNING id`,
          [lostObj.id, foundObj.id, finalScore]
        );

        const matchId = matchResult.rows[0]?.id as string;
        totalMatches++;

        // ── Evento: match encontrado ─────────────────────────────────
        Events.matchFound(object.id as string, matchId, finalScore).catch(() => {});

        // Notificar o dono do objeto PERDIDO. Nunca avisa objeto/dono legado nem conta de sistema (sinais públicos): o match continua gravado, sem aviso.
        try {
          const owner = await buscarDonoParaAviso(lostObj.id as string);
          if (owner && donoPodeSerAvisado(owner)) {
            pendingSends.push(
              sendMatchAlertEmail(
                { name: owner.name, email: owner.email },
                tituloPublico(lostObj.title as string, lostObj.source as string | null) as string,
                matchId,
                finalScore,
                tituloPublico(foundObj.title as string, foundObj.source as string | null) as string   // sinal público: nome mascarado no e-mail
              ).catch(() => {}),
              sendPushToUser(
                owner.id as string,
                matchPayload(matchId, lostObj.title as string, finalScore),
                { event: 'match' }
              ).catch(() => {})
            );
            Events.ownerNotified(lostObj.id as string, owner.id as string).catch(() => {});
          }
        } catch { /* silencioso */ }
      }

      // ── Evento: matching concluído (também é o marcador de «objeto já processado») ───────────────
      await Events.matchingCompleted(object.id as string, candidates.rows.length);
    }

    // Espera os envios (e-mail/push) e os eventos já iniciados antes de responder
    await awaitSends(pendingSends, sendWaitBudget(startedAt.getTime(), 30_000));

    const durationMs = Date.now() - startedAt.getTime();
    console.log(`[cron/matching] ${totalObjects} objetos, ${totalMatches} matches, ${durationMs}ms`);

    return NextResponse.json({
      ok: true,
      objects_processed: totalObjects,
      matches_created: totalMatches,
      duration_ms: durationMs,
      next_run_in_minutes: CRON_INTERVAL_MINUTES,
    });
  } catch (error) {
    console.error('[cron/matching] Erro:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
