// Mensagens de chat não lidas por participante.
//
// Usa a coluna chat_messages.is_read (já existe, default false, nunca foi usada pelo código). Cada mensagem tem
// um único destinatário (o outro participante do match), então is_read = "o destinatário já abriu a conversa".
// Não precisa de migration. Se a coluna não existir (42703) ou a tabela faltar (42P01), tudo se comporta como
// hoje: contagem zero e marcação sem efeito, sem erro.
//
// Só entram na contagem mensagens dos últimos 30 dias: a coluna nunca foi preenchida, então mensagens antigas
// (já lidas na prática) não podem reaparecer como "novas".
import { query } from '@/lib/db';

export const UNREAD_WINDOW_DAYS = 30;

const MISSING = new Set(['42703', '42P01']);

function isMissingSchema(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
  return !!code && MISSING.has(code);
}

export interface UnreadSummary {
  total: number;
  by_match: Record<string, number>;
}

export async function getUnreadSummary(userId: string): Promise<UnreadSummary> {
  try {
    const r = await query(
      `SELECT cm.match_id, COUNT(*)::int AS n
         FROM chat_messages cm
         JOIN matches m ON m.id = cm.match_id
         LEFT JOIN objects lo ON lo.id = m.lost_object_id
         LEFT JOIN objects fo ON fo.id = m.found_object_id
        WHERE (lo.user_id = $1 OR fo.user_id = $1)
          AND cm.sender_id <> $1
          AND cm.is_read IS NOT TRUE
          AND cm.created_at > NOW() - ($2 || ' days')::interval
        GROUP BY cm.match_id`,
      [userId, String(UNREAD_WINDOW_DAYS)],
    );
    const by_match: Record<string, number> = {};
    let total = 0;
    for (const row of r.rows as { match_id: string; n: number | string }[]) {
      const n = Number(row.n) || 0;
      by_match[row.match_id] = n;
      total += n;
    }
    return { total, by_match };
  } catch (err) {
    if (isMissingSchema(err)) return { total: 0, by_match: {} };
    throw err;
  }
}

/** Marca como lidas as mensagens que OUTROS enviaram nesta conversa. Devolve quantas mudaram. */
export async function markConversationRead(matchId: string, userId: string): Promise<number> {
  try {
    const r = await query(
      `UPDATE chat_messages SET is_read = TRUE
        WHERE match_id = $1 AND sender_id <> $2 AND is_read IS NOT TRUE`,
      [matchId, userId],
    );
    return r.rowCount ?? 0;
  } catch (err) {
    if (isMissingSchema(err)) return 0;
    throw err;
  }
}
