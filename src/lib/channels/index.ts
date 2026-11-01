import { CHANNEL_ENABLED } from './config';
import { sendApp, sendEmail, sendPush, sendSms } from './adapters';
import type { Channel, ChannelResult, MessageFor } from './types';

export * from './types';
export { CHANNEL_ENABLED } from './config';
export * from './policy';

type Adapters = { [C in Channel]: (m: MessageFor<C>) => Promise<ChannelResult> };
const DEFAULT_ADAPTERS: Adapters = { app: sendApp, push: sendPush, email: sendEmail, sms: sendSms };

/**
 * Ponto único de envio por canal. Canal desligado em CHANNEL_ENABLED devolve "canal desativado" sem chamar
 * adaptador algum. Nunca lança: falha vira resultado `failed`. Cada tentativa é registrada em log (sem
 * destinatário nem conteúdo) e o resultado é devolvido a quem chamou.
 */
export async function send<C extends Channel>(
  channel: C,
  message: MessageFor<C>,
  deps: { enabled?: Readonly<Record<Channel, boolean>>; adapters?: Partial<Adapters>; log?: (r: ChannelResult) => void } = {},
): Promise<ChannelResult> {
  const enabled = deps.enabled ?? CHANNEL_ENABLED;
  const log = deps.log ?? ((r: ChannelResult) =>
    console.log(`[channels] canal=${r.channel} status=${r.status}${'reason' in r ? ` motivo=${r.reason}` : ''}`));

  let result: ChannelResult;
  if (!enabled[channel]) {
    result = { channel, status: 'skipped', reason: 'canal desativado' };
  } else {
    try {
      const adapter = (deps.adapters?.[channel] ?? DEFAULT_ADAPTERS[channel]) as (m: MessageFor<C>) => Promise<ChannelResult>;
      result = await adapter(message);
    } catch (err) {
      result = { channel, status: 'failed', error: err instanceof Error ? err.message : 'exceção' };
    }
  }
  log(result);
  return result;
}
