// Push OPCIONAL da mensagem da plataforma (Q-17): decidido pelo administrador, mensagem por mensagem
// (campo `push` da rota POST /api/v1/admin/platform-messages). A mensagem in-app é sempre gravada ANTES;
// falha aqui nunca a impede nem a desfaz.
//
// PLATFORM_MESSAGE_PUSH_ENABLED é a chave de segurança geral: com `false` nenhum push desta mensagem sai,
// mesmo que o administrador marque a opção, e o comportamento volta a ser somente in-app, sem desfazer o PR.
//
// Regras embutidas: legado e conta de sistema recusados; a PREFERÊNCIA DO USUÁRIO vence a escolha do
// administrador (migration 024, aplicada em 04/11/2026); sem a tabela de preferências NÃO envia; texto fixo e
// curto (nunca o texto do administrador), link só interno; sem e-mail.
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';

export const PLATFORM_MESSAGE_PUSH_ENABLED = true;
export const PLATFORM_MESSAGE_PREFERENCE_EVENT = 'platform_message';

export type PlatformPushResult =
  | { sent: true }
  | { sent: false; reason: 'desligado' | 'conta_de_sistema' | 'legado' | 'usuario_nao_encontrado' | 'preferencia_desligada' | 'sem_push_ativo' | 'preferencias_indisponiveis' | 'erro_no_envio' };

export async function pushPlatformMessage(
  userId: string,
  opts: { enabled?: boolean } = {},
): Promise<PlatformPushResult> {
  if (!(opts.enabled ?? PLATFORM_MESSAGE_PUSH_ENABLED)) return { sent: false, reason: 'desligado' };

  const u = await query(
    `SELECT COALESCE(u.is_system_account, false) AS is_system,
            COALESCE(u.is_legacy, false) OR EXISTS (SELECT 1 FROM objects o WHERE o.user_id = u.id AND o.is_legacy = true) AS is_legacy
       FROM users u WHERE u.id = $1`,
    [userId],
  );
  const row = u.rows[0] as { is_system: boolean; is_legacy: boolean } | undefined;
  if (!row) return { sent: false, reason: 'usuario_nao_encontrado' };
  if (row.is_system) return { sent: false, reason: 'conta_de_sistema' };
  if (row.is_legacy) return { sent: false, reason: 'legado' };

  try {
    const p = await query(
      `SELECT enabled FROM notification_preferences WHERE user_id = $1 AND event = $2 AND channel = 'push'`,
      [userId, PLATFORM_MESSAGE_PREFERENCE_EVENT],
    );
    const pref = p.rows[0] as { enabled: boolean } | undefined;
    if (pref && pref.enabled === false) return { sent: false, reason: 'preferencia_desligada' };
  } catch {
    // Tabela ausente ou banco indisponível: nesta funcionalidade, na dúvida NÃO envia.
    return { sent: false, reason: 'preferencias_indisponiveis' };
  }

  try {
    // Sem VAPID configurado o envio central não faz nada: não finge que enviou.
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { sent: false, reason: 'erro_no_envio' };
    const subs = await query(`SELECT 1 FROM push_subscriptions WHERE user_id = $1 LIMIT 1`, [userId]);
    if (subs.rows.length === 0) return { sent: false, reason: 'sem_push_ativo' };

    await sendPushToUser(userId, {
      title: 'Você tem uma mensagem da equipe do Backfindr',
      body: 'Abra as notificações para ler.',
      url: '/dashboard/notifications',
      tag: 'platform-message',
    }, { event: 'platform_message' });
    return { sent: true };
  } catch {
    return { sent: false, reason: 'erro_no_envio' };
  }
}

/** Frase curta para o administrador (resposta da rota e tela do admin). */
export function platformPushLabel(r: PlatformPushResult): string {
  if (r.sent) return 'push enviado';
  switch (r.reason) {
    case 'sem_push_ativo': return 'usuário sem push ativo';
    case 'preferencia_desligada': return 'usuário desligou esse aviso';
    case 'legado':
    case 'conta_de_sistema': return 'push não enviado (legado/conta de sistema)';
    case 'desligado': return 'push não enviado (desativado pelo sistema)';
    default: return 'push não enviado (falha técnica)';
  }
}
