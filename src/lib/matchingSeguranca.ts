// Interruptor e travas de segurança do matching AUTOMÁTICO.
//
// MATCHING_ATIVO=1 liga SÓ os caminhos automáticos: o gancho de criação de objeto e a rota cron/matching.
// Sem a chave (padrão), eles não fazem nada. O botão manual do painel e a rota individual chamada à mão NÃO dependem dela.
import { query } from '@/lib/db';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';

export const MATCHING_ATIVO = (): boolean => process.env.MATCHING_ATIVO === '1';

export interface DonoParaAviso {
  id: string;
  name: string;
  email: string;
  /** Objeto legado ou dono legado: nunca recebe e-mail, push nem aviso. */
  legacy_blocked: boolean;
  /** Conta de sistema (sinais públicos): não é pessoa, não recebe e-mail, push nem aviso. */
  is_system_account: boolean;
}

/** Dono do objeto, com as duas travas. Sem dono: null. */
export async function buscarDonoParaAviso(objectId: string): Promise<DonoParaAviso | null> {
  const r = await query(
    `SELECT u.id, u.name, u.email,
            (o.is_legacy IS TRUE OR COALESCE(u.is_legacy, false) IS TRUE) AS legacy_blocked,
            (COALESCE(u.is_system_account, false) IS TRUE OR u.id = $2) AS is_system_account
       FROM users u
       JOIN objects o ON o.user_id = u.id
      WHERE o.id = $1`,
    [objectId, SYSTEM_ACCOUNT_ID],
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    legacy_blocked: row.legacy_blocked === true,
    is_system_account: row.is_system_account === true,
  };
}

/** Pode receber e-mail, push e aviso: não é legado e não é conta de sistema. */
export function donoPodeSerAvisado(dono: Pick<DonoParaAviso, 'legacy_blocked' | 'is_system_account'>): boolean {
  return !dono.legacy_blocked && !dono.is_system_account;
}
