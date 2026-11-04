// Push OPCIONAL para a mensagem da plataforma (Q-17), PREPARADO E DESLIGADO.
//
// Decisão desta fase: NÃO enviar push. A mensagem continua somente in-app. Este módulo existe para que, quando o
// Marcos decidir, ligar seja pequeno e já testado:
//   1. aplicar a migration 024 (aceita o evento 'platform_message' em notification_preferences);
//   2. trocar PLATFORM_MESSAGE_PUSH_ENABLED para true;
//   3. chamar pushPlatformMessage(...) na rota POST /api/v1/admin/platform-messages, depois do INSERT.
// Nada disso foi feito: a rota não chama este módulo.
//
// Regras já embutidas: legado e conta de sistema recusados; só envia se o usuário não desligou o push deste evento;
// sem a tabela de preferências (ou qualquer erro ao consultá-la) NÃO envia; texto fixo e curto (nunca o texto do
// admin), link só interno; sem e-mail.
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';

export const PLATFORM_MESSAGE_PUSH_ENABLED = false;
export const PLATFORM_MESSAGE_PREFERENCE_EVENT = 'platform_message';

export type PlatformPushResult =
  | { sent: true }
  | { sent: false; reason: 'desligado' | 'conta_de_sistema' | 'legado' | 'usuario_nao_encontrado' | 'preferencia_desligada' | 'preferencias_indisponiveis' | 'erro_no_envio' };

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
    // Sem push ativado (nenhum dispositivo inscrito) o envio simplesmente não acontece.
    await sendPushToUser(userId, {
      title: 'Você tem uma mensagem da equipe do Backfindr',
      body: 'Abra as notificações para ler.',
      url: '/dashboard/notifications',
      tag: 'platform-message',
    });
    return { sent: true };
  } catch {
    return { sent: false, reason: 'erro_no_envio' };
  }
}
