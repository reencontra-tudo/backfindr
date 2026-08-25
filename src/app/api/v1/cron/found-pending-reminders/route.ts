export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { recordEvent } from '@/lib/events';

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
 * IMPORTANTE: esta rota existe e foi testada manualmente, mas ainda NÃO
 * está agendada em lugar nenhum (nem Vercel Cron, nem n8n) — precisa ser
 * conectada a um schedule externo (mesmo padrão do cron n8n "Backfindr
 * Public Signals — Ingestão Diária"), 1x/dia é suficiente dado o intervalo
 * de dias. Ver BACKFINDR.md seção 17.
 *
 * Dedup via `user_lifecycle_events` (tabela já existente, reaproveitada —
 * mesmo padrão de src/app/api/v1/cron/lifecycle/route.ts) chaveado por
 * (user_id, object_id, event_type), pra nunca mandar o mesmo lembrete duas
 * vezes mesmo se o cron rodar mais de uma vez no mesmo dia.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'default-secret';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const results = {
    reminders_d3: 0,
    reminders_d7: 0,
    auto_dismissed_d14: 0,
    errors: [] as string[],
  };

  try {
    // ─── D+3: primeiro lembrete ────────────────────────────────────────────
    try {
      const d3Result = await query(
        `SELECT o.id, o.user_id, o.title
           FROM objects o
          WHERE o.found_pending_confirmation = true
            AND o.found_pending_since <= NOW() - INTERVAL '3 days'
            AND o.found_pending_since >  NOW() - INTERVAL '4 days'
            AND o.user_id IS NOT NULL
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
