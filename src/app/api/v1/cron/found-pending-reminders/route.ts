export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { recordEvent } from '@/lib/events';
import { MENSAGENS_ATIVO, DIAS_ABERTA_PARADA, MESES_GUARDA_APOS_ENCERRAR, meses, tituloLimpo } from '@/lib/conversas';

/**
 * Rota de Cron Job — item 3a do ciclo found→returned (25/08/2026, opção D
 * do desenho aprovado por Marcos): o que fazer quando o dono não responde
 * ao FoundBanner ("Confirmar devolução"/"Ainda não recebi").
 *
 * - D+3 e D+7: lembrete push pro dono, sem mexer em nada no objeto.
 * - D+14: se ainda não respondeu, descarta a sinalização sozinho
 *   (found_pending_confirmation = false) — como esse campo nunca mudou o
 *   `status` real do objeto (ver /notify e FoundBanner), esse timeout NUNCA
 *   desfaz um retorno real nem qualquer outro dado; só limpa um sinal que
 *   ficou sem resposta por 2 semanas.
 *
 * Agendamento: workflow do n8n "Backfindr Found Pending — Lembretes e Timeout",
 * diário às 2h (horário do servidor do n8n), com GET nesta rota e o header
 * `Authorization: Bearer <CRON_SECRET>`. Se o CRON_SECRET for rotacionado na
 * Vercel, o header desse nó precisa ser atualizado junto; senão a rota
 * responde 401 e o lembrete deixa de rodar. Ver docs/ROTACAO-SEGREDOS.md e
 * BACKFINDR.md seção 17.
 *
 * Dedup via `user_lifecycle_events` (tabela já existente, reaproveitada —
 * mesmo padrão de src/app/api/v1/cron/lifecycle/route.ts) chaveado por
 * (user_id, object_id, event_type), pra nunca mandar o mesmo lembrete duas
 * vezes mesmo se o cron rodar mais de uma vez no mesmo dia.
 */
// Com a área de mensagens ligada, a marca «achado pendente» vem do «É o meu» do dono e pertence a uma conversa: os lembretes dela
// e o descarte automático NÃO mexem nessas marcas (o dono disse que o objeto é dele; nada o desfaz sozinho). Só as marcas antigas, sem conversa, seguem como antes.
const SEM_CONVERSA = (alias = 'o') => MENSAGENS_ATIVO()
  ? `AND NOT EXISTS (SELECT 1 FROM conversas cv WHERE cv.object_id = ${alias}.id AND cv.confirmado_dono_em IS NOT NULL)`
  : '';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed (26/08/2026): copiei o fallback hardcoded de lifecycle/route.ts
  // sem questionar quando escrevi esta rota — mesmo defeito, mesmo fix. Sem
  // CRON_SECRET, a rota recusa qualquer chamada em vez de aceitar uma string
  // pública conhecida.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const results = {
    reminders_d1: 0,
    reminders_d3: 0,
    reminders_d7: 0,
    auto_dismissed_d14: 0,
    errors: [] as string[],
  };

  try {
    // ─── D+1: primeiro aviso ───────────────────────────────────────────────
    // Janela: 1 dia <= idade < 2 dias. Respeita a preferência de push do evento 'qr_scan'.
    try {
      const d1Result = await query(
        `SELECT o.id, o.user_id, o.title
           FROM objects o
          WHERE o.found_pending_confirmation = true
            AND o.found_pending_since <= NOW() - INTERVAL '1 day'
            AND o.found_pending_since >  NOW() - INTERVAL '2 days'
            AND o.user_id IS NOT NULL
            AND o.is_legacy IS NOT TRUE
            ${SEM_CONVERSA()}
            AND NOT EXISTS (SELECT 1 FROM users ux WHERE ux.id = o.user_id AND (ux.is_legacy IS TRUE OR ux.is_system_account IS TRUE))
            AND (SELECT COUNT(*) FROM user_lifecycle_events
                  WHERE user_id = o.user_id AND object_id = o.id
                    AND event_type = 'found_pending_reminder_d1') = 0
          LIMIT 200`
      );
      for (const row of d1Result.rows as { id: string; user_id: string; title: string }[]) {
        try {
          await sendPushToUser(row.user_id, {
            title: '👀 Sinalização aguardando sua resposta',
            body: `Alguém sinalizou que encontrou "${row.title}". Confirme ou descarte na página do objeto.`,
            url: `/dashboard/objects/${row.id}`,
            tag: `found-pending-d1-${row.id}`,
          }, { event: 'qr_scan' });
          await query(
            `INSERT INTO user_lifecycle_events (user_id, object_id, event_type, created_at)
             VALUES ($1, $2, 'found_pending_reminder_d1', NOW())`,
            [row.user_id, row.id]
          ).catch(() => {});
          results.reminders_d1++;
        } catch (err) {
          results.errors.push(`Erro ao enviar lembrete D+1 (objeto ${row.id}): ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar objetos D+1: ${err}`);
    }

    // ─── D+3: primeiro lembrete ────────────────────────────────────────────
    try {
      const d3Result = await query(
        `SELECT o.id, o.user_id, o.title
           FROM objects o
          WHERE o.found_pending_confirmation = true
            AND o.found_pending_since <= NOW() - INTERVAL '3 days'
            AND o.found_pending_since >  NOW() - INTERVAL '4 days'
            AND o.user_id IS NOT NULL
            AND o.is_legacy IS NOT TRUE
            ${SEM_CONVERSA()}
            AND NOT EXISTS (SELECT 1 FROM users ux WHERE ux.id = o.user_id AND (ux.is_legacy IS TRUE OR ux.is_system_account IS TRUE))
            AND (SELECT COUNT(*) FROM user_lifecycle_events
                  WHERE user_id = o.user_id AND object_id = o.id
                    AND event_type = 'found_pending_reminder_d3') = 0
          LIMIT 200`
      );
      for (const row of d3Result.rows as { id: string; user_id: string; title: string }[]) {
        try {
          await sendPushToUser(row.user_id, {
            title: '👀 Ainda esperando sua confirmação',
            body: `Alguém sinalizou que encontrou "${row.title}" há 3 dias. Confirme ou descarte na página do objeto.`,
            url: `/dashboard/objects/${row.id}`,
            tag: `found-pending-d3-${row.id}`,
          });
          await query(
            `INSERT INTO user_lifecycle_events (user_id, object_id, event_type, created_at)
             VALUES ($1, $2, 'found_pending_reminder_d3', NOW())`,
            [row.user_id, row.id]
          ).catch(() => {});
          results.reminders_d3++;
        } catch (err) {
          results.errors.push(`Erro ao enviar lembrete D+3 (objeto ${row.id}): ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar objetos D+3: ${err}`);
    }

    // ─── D+7: segundo lembrete ─────────────────────────────────────────────
    try {
      const d7Result = await query(
        `SELECT o.id, o.user_id, o.title
           FROM objects o
          WHERE o.found_pending_confirmation = true
            AND o.found_pending_since <= NOW() - INTERVAL '7 days'
            AND o.found_pending_since >  NOW() - INTERVAL '8 days'
            AND o.user_id IS NOT NULL
            AND o.is_legacy IS NOT TRUE
            ${SEM_CONVERSA()}
            AND NOT EXISTS (SELECT 1 FROM users ux WHERE ux.id = o.user_id AND (ux.is_legacy IS TRUE OR ux.is_system_account IS TRUE))
            AND (SELECT COUNT(*) FROM user_lifecycle_events
                  WHERE user_id = o.user_id AND object_id = o.id
                    AND event_type = 'found_pending_reminder_d7') = 0
          LIMIT 200`
      );
      for (const row of d7Result.rows as { id: string; user_id: string; title: string }[]) {
        try {
          await sendPushToUser(row.user_id, {
            title: '⏳ Última chance antes de descartarmos sozinhos',
            body: `"${row.title}" tem uma sinalização de "encontrei" aberta há 7 dias. Sem resposta até o dia 14, ela será descartada automaticamente.`,
            url: `/dashboard/objects/${row.id}`,
            tag: `found-pending-d7-${row.id}`,
          });
          await query(
            `INSERT INTO user_lifecycle_events (user_id, object_id, event_type, created_at)
             VALUES ($1, $2, 'found_pending_reminder_d7', NOW())`,
            [row.user_id, row.id]
          ).catch(() => {});
          results.reminders_d7++;
        } catch (err) {
          results.errors.push(`Erro ao enviar lembrete D+7 (objeto ${row.id}): ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar objetos D+7: ${err}`);
    }

    // ─── D+14: descarte automático ─────────────────────────────────────────
    try {
      const d14Result = await query(
        `UPDATE objects
            SET found_pending_confirmation = false,
                found_pending_since = NULL,
                updated_at = NOW()
          WHERE found_pending_confirmation = true
            AND found_pending_since <= NOW() - INTERVAL '14 days'
            ${SEM_CONVERSA('objects')}
          RETURNING id, user_id`
      );
      for (const row of d14Result.rows as { id: string; user_id: string | null }[]) {
        if (row.user_id) {
          recordEvent({
            object_id: row.id,
            user_id: row.user_id,
            type: 'found_pending_auto_dismissed',
            title: 'Sinalização de "encontrei" descartada automaticamente (14 dias sem resposta)',
            source: 'system',
          }).catch(() => {});
        }
        results.auto_dismissed_d14++;
      }
    } catch (err) {
      results.errors.push(`Erro ao descartar sinalizações D+14: ${err}`);
    }

    // ─── Conversas (área de mensagens; só com MENSAGENS_ATIVO=1) ─────────────────────────────────────────────────────
    // (a) lembretes D+1, D+3, D+7 ao dono NÃO legado: aviso aguardando a decisão dele (contado da criação do aviso) e
    //     «É o meu» aguardando «Confirmar devolução» (contado do «É o meu»); (b) conversa aberta parada há 30 dias é arquivada.
    // Nada disso altera objeto algum. Push de texto fixo. Dedup por user_lifecycle_events (um lembrete por objeto e dia-marco).
    if (MENSAGENS_ATIVO()) {
      try {
        for (const [tipo, coluna, titulo, texto, estado] of [
          ['aguardando', 'c.criada_em', '👀 Aviso aguardando sua resposta', (t: string) => `Alguém avisou que pode ter encontrado "${t}". Veja o aviso e decida se quer conversar.`, `c.estado = 'aguardando' AND c.confirmado_dono_em IS NULL`],
          ['e_o_meu', 'c.confirmado_dono_em', '👀 Devolução aguardando confirmação', (t: string) => `Quando "${t}" for devolvido, confirme a devolução na conversa.`, `c.estado = 'aberta' AND c.confirmado_dono_em IS NOT NULL`],
        ] as [string, string, string, (t: string) => string, string][]) {
          for (const dia of [1, 3, 7]) {
            const r = await query(
              `SELECT c.id, c.dono_id, COALESCE(c.objeto_titulo, 'seu objeto') AS titulo, c.object_id
                 FROM conversas c JOIN users u ON u.id = c.dono_id
                WHERE ${estado}
                  AND ${coluna} <= NOW() - INTERVAL '${dia} days' AND ${coluna} > NOW() - INTERVAL '${dia + 1} days'
                  AND COALESCE(u.is_legacy, false) = false AND COALESCE(u.is_system_account, false) = false
                  AND NOT EXISTS (SELECT 1 FROM objects ob WHERE ob.id = c.object_id AND ob.is_legacy IS TRUE)
                  AND NOT EXISTS (SELECT 1 FROM user_lifecycle_events le WHERE le.user_id = c.dono_id AND le.object_id = c.object_id AND le.event_type = $1)
                LIMIT 200`,
              [`conversa_${tipo}_d${dia}`],
            );
            for (const row of r.rows as { id: string; dono_id: string; titulo: string; object_id: string }[]) {
              try {
                await sendPushToUser(row.dono_id, { title: titulo, body: texto(tituloLimpo(row.titulo)), url: `/dashboard/mensagens/${row.id}`, tag: `conversa-${tipo}-${row.id}-${dia}` }, { event: 'qr_scan' });
                await query(`INSERT INTO user_lifecycle_events (user_id, object_id, event_type, created_at) VALUES ($1, $2, $3, NOW())`, [row.dono_id, row.object_id, `conversa_${tipo}_d${dia}`]).catch(() => {});
                (results as unknown as Record<string, number>).conversas_lembretes = ((results as unknown as Record<string, number>).conversas_lembretes ?? 0) + 1;
              } catch (err) { results.errors.push(`Erro no lembrete da conversa ${row.id}: ${err}`); }
            }
          }
        }
        const arq = await query(
          `UPDATE conversas SET estado = 'arquivada', motivo = 'inatividade', encerrada_em = NOW(), retencao_ate = ${meses(MESES_GUARDA_APOS_ENCERRAR)}
            WHERE estado = 'aberta' AND ultima_atividade <= NOW() - INTERVAL '${DIAS_ABERTA_PARADA} days' RETURNING id`,
        );
        for (const row of arq.rows as { id: string }[]) {
          await query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto, tipo) VALUES ($1, NULL, 'Conversa arquivada por inatividade.', 'sistema')`, [row.id]).catch(() => {});
        }
        (results as unknown as Record<string, unknown>).conversas_arquivadas = arq.rows.length;
      } catch (err) {
        results.errors.push(`Erro nas rotinas das conversas: ${err}`);
      }
    }

    console.log('[cron/found-pending-reminders] Resultado:', results);
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron/found-pending-reminders] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500 }
    );
  }
}
