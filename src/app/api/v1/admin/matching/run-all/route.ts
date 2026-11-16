export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { sendMatchAlertEmail } from '@/lib/email';
import {
  calculateMatchScore as calculateMatchScoreBase,
  expandCategoryGroup,
  classifyStage2,
  semanticMatchScore,
  STAGE3_SEMANTIC_ACCEPT_THRESHOLD,
} from '@/lib/matching';
import { awaitSends, sendWaitBudget } from '@/lib/awaitSends';
import { tituloPublico } from '@/lib/objectPublicView';
import { buscarDonoParaAviso, donoPodeSerAvisado } from '@/lib/matchingSeguranca';
import { buscarGatilhosNovos, montarBuscaDeCandidatos, parPodeVirarMatch, papeisDoPar, statusDosCandidatos } from '@/lib/matchingFiltro';
import { Events } from '@/lib/events';

const MAX_RADIUS_KM = 50;

// Consolidado em 26/08/2026 em src/lib/matching.ts — mantém exatamente o
// mesmo comportamento de antes (bônus de marca, sem sinônimo/descrição), só
// sem a lógica duplicada localmente. Ver comentário completo no módulo.
function calculateMatchScore(obj: Record<string, unknown>, candidate: Record<string, unknown>): number {
  return calculateMatchScoreBase(obj, candidate, { brand: true });
}

// ─── POST /api/v1/admin/matching/run-all ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Gatilhos: os MESMOS do cron (src/lib/matchingFiltro.ts) — objetos NOVOS (cadastrados depois do corte de reativação), de dono não legado,
    // perdidos, roubados ou achados, que ainda NÃO foram processados (sem matching_completed). Objetos anteriores ao corte não são gatilho.
    // (Contexto antigo: em 29/08/2026 o gatilho passou a excluir o legado, que era 93% da base e mandava ~386 candidatos ao estágio 3 numa rodada, 0 aceitos.)
    // Este botão continua NÃO dependendo do interruptor do matching automático.
    const lostObjects = { rows: await buscarGatilhosNovos(200) };

    let totalCreated = 0;
    let totalChecked = 0;
    const pendingSends: Promise<unknown>[] = [];
    const startedAtMs = Date.now();
    // Estágio 3 formalizado aqui pela primeira vez (27/08/2026) — antes só
    // existia no caminho individual. Contadores pra reportar o custo real,
    // não só o resultado final.
    let totalAmbiguous = 0;
    let totalSemanticAccepted = 0;

    for (const object of lostObjects.rows) {
      Events.matchingStarted(object.id as string).catch(() => {});
      // Candidatos pelo filtro central (src/lib/matchingFiltro.ts): não legados (objeto e dono) e ordem das datas da OCORRÊNCIA.
      // animal/pet são o mesmo conceito com nome diferente por herança do legado (expandCategoryGroup).
      const categoryGroup = object.category ? expandCategoryGroup(object.category as string) : null;
      const busca = montarBuscaDeCandidatos(object, {
        statuses: statusDosCandidatos(object.status),
        categoryGroup,
        maxRadiusKm: MAX_RADIUS_KM,
        ordem: 'criacao',
        limiteComCoordenada: 100,
        limiteSemCoordenada: 50,
        semCategoriaSemCoordenada: 'pular',
      });
      if (!busca) { await Events.matchingCompleted(object.id as string, 0); continue; } // sem localização e sem categoria, pula (e fica marcado como processado)

      const candidates = await query(busca.sql, busca.params);
      totalChecked += candidates.rows.length;

      for (const candidate of candidates.rows) {
        const score = calculateMatchScore(object, candidate); // só exibição (coluna score)

        // Funil em estágios (27/08/2026, ver src/lib/matching.ts) — overlap
        // de texto real obrigatório primeiro, confiança (sem categoria)
        // decide DIRETO vs AMBÍGUO entre quem sobreviveu.
        const stage2 = classifyStage2(object, candidate, {}, { brand: true });

        let finalScore: number | null = null;
        if (stage2.decision === 'direct') {
          finalScore = score;
        } else if (stage2.decision === 'ambiguous') {
          // Estágio 3 — antes não existia neste caminho, só no individual.
          // Volume estimado contra a base atual: ~9 candidatos ambíguos no
          // total do sistema, seguro rodar síncrono aqui.
          totalAmbiguous++;
          const aiScore = await semanticMatchScore(object, candidate);
          if (aiScore >= STAGE3_SEMANTIC_ACCEPT_THRESHOLD) {
            finalScore = Math.round((score + aiScore) / 2);
            totalSemanticAccepted++;
          }
        }
        if (finalScore === null) continue; // eliminado, ou ambíguo rejeitado pela LLM

        // Último ponto antes de gravar: par fora da ordem das datas da ocorrência nunca vira match, nem pendente.
        if (!parPodeVirarMatch(object, candidate)) continue;

        // Quem é o perdido (lost ou stolen) e quem é o achado (found): sempre pelo status, qualquer que seja o gatilho.
        const papeis = papeisDoPar(object, candidate);
        if (!papeis) continue;
        const lostObj = papeis.perdido;
        const foundObj = papeis.achado;

        // Verifica se já existe match entre esses dois objetos
        const existing = await query(
          `SELECT id FROM matches
           WHERE (lost_object_id = $1 AND found_object_id = $2)
              OR (lost_object_id = $2 AND found_object_id = $1)`,
          [object.id, candidate.id]
        );
        if (existing.rows.length > 0) continue;

        const matchResult = await query(
          `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', NOW(), NOW())
           RETURNING id`,
          [lostObj.id, foundObj.id, finalScore]
        );
        totalCreated++;

        // ── Notificar o dono do objeto perdido por e-mail (assíncrono) ─────────────────────
        // Nunca avisa objeto/dono legado nem conta de sistema (sinais públicos); o match continua gravado. Título de sinal público sai sem nome.
        try {
          const owner = await buscarDonoParaAviso(lostObj.id as string);
          if (owner && donoPodeSerAvisado(owner)) {
            pendingSends.push(
              sendMatchAlertEmail(
                { name: owner.name, email: owner.email },
                tituloPublico(lostObj.title as string, lostObj.source as string | null) as string,
                matchResult.rows[0]?.id ?? '',
                finalScore,
                tituloPublico(foundObj.title as string, foundObj.source as string | null) as string
              ).catch(err => console.error('[admin/matching] Falha ao enviar e-mail de match:', err))
            );
          }
        } catch (emailErr) {
          console.error('[admin/matching] Erro ao buscar dono para notificação:', emailErr);
        }
      }

      // Fim da rodada deste objeto: também é o marcador de «objeto já processado».
      await Events.matchingCompleted(object.id as string, candidates.rows.length);
    }

    // Espera os e-mails já iniciados antes de responder
    await awaitSends(pendingSends, sendWaitBudget(startedAtMs, 30_000));

    return NextResponse.json({
      message: `Matching completo. ${totalCreated} match(es) criado(s) de ${totalChecked} candidatos verificados (${totalAmbiguous} ambíguo(s) enviado(s) ao estágio 3, ${totalSemanticAccepted} confirmado(s) pela IA).`,
      matches_created: totalCreated,
      candidates_checked: totalChecked,
      stage3_ambiguous: totalAmbiguous,
      stage3_accepted: totalSemanticAccepted,
      objects_processed: lostObjects.rows.length,
    });
  } catch (e) {
    console.error('[admin/matching/run-all]', e);
    return NextResponse.json({ detail: 'Erro ao rodar matching' }, { status: 500 });
  }
}
