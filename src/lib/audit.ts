import type { QueryResult } from 'pg';
import { getClient } from '@/lib/db';
import type { AuditActor } from '@/lib/governance';

/**
 * Executa escritas numa transação que informa o ATOR à trilha de auditoria (migração 018):
 * `set_config(..., true)` = SET LOCAL, válido só nesta transação. Os gatilhos leem app.actor_id, app.actor_type,
 * app.impersonated_id, app.origin e app.request_id. Sem isso a trilha grava ator = 'desconhecido' (nunca falha).
 *
 * ATENÇÃO: o pool tem 1 conexão (lib/db.ts). Dentro de `fn` use SOMENTE o `q` recebido — chamar `query()` aqui
 * esperaria uma segunda conexão e travaria.
 */
export type Q = (text: string, params?: unknown[]) => Promise<QueryResult>;

export async function withActor<T>(actor: AuditActor, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.actor_id', $1, true), set_config('app.actor_type', $2, true),
              set_config('app.impersonated_id', $3, true), set_config('app.origin', $4, true),
              set_config('app.request_id', $5, true)`,
      [actor.id ?? '', actor.type, actor.impersonatedId ?? '', actor.origin, actor.requestId ?? '']
    );
    const out = await fn((text, params) => client.query(text, params as unknown[] | undefined));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* conexão já caiu */ }
    throw err;
  } finally {
    client.release();
  }
}

/** Evento de conta/ação sensível na trilha (audit.account_events). Falha de auditoria não derruba o fluxo. */
export async function logEvent(
  q: Q, event: string, actor: AuditActor, targetId: string | null, details: Record<string, unknown> = {}
): Promise<void> {
  // SAVEPOINT: um erro dentro da transação a abortaria por inteiro, mesmo capturado no JS
  try {
    await q('SAVEPOINT audit_event');
    await q(
      'SELECT audit.log_event($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [event, actor.id, actor.type, targetId, actor.origin, actor.requestId, JSON.stringify(details)]
    );
    await q('RELEASE SAVEPOINT audit_event');
  } catch (err) {
    console.error('[audit] logEvent falhou:', event, err);
    try { await q('ROLLBACK TO SAVEPOINT audit_event'); } catch { /* transação já perdida */ }
  }
}
