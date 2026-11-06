// Regras puras (sem banco, sem envio) previstas para a camada de canais. NÃO estão ativas nos fluxos atuais.
import type { Urgency } from './types';

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
/** Silêncio das 22h (inclusive) às 7h (exclusive), no fuso do usuário. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;

/** Hora cheia (0-23) de `now` no fuso informado. Fuso inválido cai no padrão de São Paulo. */
export function localHour(now: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const get = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).formatToParts(now);
  let parts;
  try { parts = get(timeZone); } catch { parts = get(DEFAULT_TIME_ZONE); }
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

/** true dentro da janela de silêncio; trata a virada do dia (22h–7h). */
export function isQuietHour(now: Date, timeZone: string = DEFAULT_TIME_ZONE): boolean {
  const h = localHour(now, timeZone);
  return QUIET_START_HOUR > QUIET_END_HOUR
    ? h >= QUIET_START_HOUR || h < QUIET_END_HOUR
    : h >= QUIET_START_HOUR && h < QUIET_END_HOUR;
}

/** Eventos que saem sempre, mesmo no silêncio: achado pelo QR e mensagem de chat. */
export const ALWAYS_SEND_EVENTS = ['qr_scan', 'chat_message'] as const;

/** Urgência de cada evento conhecido; desconhecido é tratado como baixa. */
export function urgencyForEvent(event: string): Urgency {
  if ((ALWAYS_SEND_EVENTS as readonly string[]).includes(event)) return 'high';
  if (event === 'match' || event === 'returned') return 'medium';
  return 'low';
}

/**
 * Push deve esperar? Só baixa e média urgência, dentro do silêncio, e nunca os eventos que saem sempre.
 * (Alta urgência = achado pelo QR e mensagem de chat.)
 */
export function shouldDeferPush(args: { event: string; now: Date; timeZone?: string }): boolean {
  if ((ALWAYS_SEND_EVENTS as readonly string[]).includes(args.event)) return false;
  if (urgencyForEvent(args.event) === 'high') return false;
  return isQuietHour(args.now, args.timeZone);
}
