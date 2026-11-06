import { query } from '@/lib/db';

/**
 * Usuário legado (users.is_legacy) é SOMENTE LEITURA até atualizar a conta
 * (decisão do Marcos de 05/11/2026): pode entrar e ver, mas não inclui, edita
 * nem exclui objetos. Só lê o próprio usuário que fez a requisição; não envia
 * nada, não grava nada e não muda o que o legado exibe (sitemap, mapa, busca).
 */
export const LEGACY_READ_ONLY_MESSAGE =
  'Sua conta ainda é uma conta antiga (legado). Atualize sua conta para incluir, editar ou excluir objetos.';

export async function isLegacyUser(userId: string): Promise<boolean> {
  const r = await query('SELECT is_legacy FROM users WHERE id = $1', [userId]);
  return r.rows[0]?.is_legacy === true;
}

export function legacyReadOnlyResponse(): Response {
  return Response.json(
    { detail: LEGACY_READ_ONLY_MESSAGE, error: 'legacy_read_only' },
    { status: 403 },
  );
}
