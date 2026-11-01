// Preferências de aviso por evento e canal (migration 023). Só guarda o que o usuário mudou:
// sem linha, ou sem a tabela, vale "ligado" (o comportamento de antes). E-mail de segurança não é
// um evento daqui e nunca passa por estas funções.
import { query } from './db';

export const PREFERENCE_EVENTS = ['match', 'qr_scan', 'chat_message', 'returned'] as const;
export type PreferenceEvent = (typeof PREFERENCE_EVENTS)[number];

export const PREFERENCE_CHANNELS = ['app', 'push', 'email'] as const;
export type PreferenceChannel = (typeof PREFERENCE_CHANNELS)[number];

// Canais que os pontos de envio já respeitam. Os demais ficam previstos no modelo, mas a API os recusa
// enquanto nada os aplica, para a tela não prometer um efeito que não existe.
export const ENFORCED_CHANNELS: readonly PreferenceChannel[] = ['push'];

export function isPreferenceEvent(v: unknown): v is PreferenceEvent {
  return typeof v === 'string' && (PREFERENCE_EVENTS as readonly string[]).includes(v);
}
export function isEnforcedChannel(v: unknown): v is PreferenceChannel {
  return typeof v === 'string' && (ENFORCED_CHANNELS as readonly string[]).includes(v);
}

/** true = pode avisar. Qualquer falha (tabela inexistente, banco indisponível) conta como ligado. */
export async function isChannelEnabled(
  userId: string,
  event: PreferenceEvent,
  channel: PreferenceChannel,
): Promise<boolean> {
  try {
    const r = await query(
      `SELECT enabled FROM notification_preferences WHERE user_id = $1 AND event = $2 AND channel = $3`,
      [userId, event, channel],
    );
    const row = r.rows[0] as { enabled: boolean } | undefined;
    return row ? row.enabled !== false : true;
  } catch {
    return true;
  }
}

/** Matriz completa evento × canal, com "ligado" onde não há linha. */
export async function getPreferences(userId: string): Promise<Record<PreferenceEvent, Record<PreferenceChannel, boolean>>> {
  const matrix = {} as Record<PreferenceEvent, Record<PreferenceChannel, boolean>>;
  for (const e of PREFERENCE_EVENTS) matrix[e] = { app: true, push: true, email: true };
  try {
    const r = await query(`SELECT event, channel, enabled FROM notification_preferences WHERE user_id = $1`, [userId]);
    for (const row of r.rows as { event: string; channel: string; enabled: boolean }[]) {
      if (isPreferenceEvent(row.event) && (PREFERENCE_CHANNELS as readonly string[]).includes(row.channel)) {
        matrix[row.event][row.channel as PreferenceChannel] = row.enabled !== false;
      }
    }
  } catch {
    /* sem tabela: tudo ligado */
  }
  return matrix;
}

/** Lança se a gravação falhar (ex.: tabela ainda não aplicada); quem chama decide a resposta. */
export async function setPreference(
  userId: string,
  event: PreferenceEvent,
  channel: PreferenceChannel,
  enabled: boolean,
): Promise<void> {
  await query(
    `INSERT INTO notification_preferences (user_id, event, channel, enabled, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, event, channel) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
    [userId, event, channel, enabled],
  );
}
