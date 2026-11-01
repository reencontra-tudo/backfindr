// Camada única de canais de aviso (Fase 0, item 5). Código novo, ainda sem chamadores: nenhum fluxo
// existente passa por aqui.
export const CHANNELS = ['app', 'push', 'email', 'sms'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Urgência do aviso; define se o horário de silêncio se aplica (ver policy.ts). */
export type Urgency = 'low' | 'medium' | 'high';

export type ChannelResult =
  | { channel: Channel; status: 'sent'; detail?: string }
  | { channel: Channel; status: 'skipped'; reason: string }
  | { channel: Channel; status: 'failed'; error: string };

export interface AppMessage { userId: string; title: string; message: string; type: string; url?: string }
export interface PushMessage { userId: string; title: string; body: string; url?: string; tag?: string }
export interface EmailMessage {
  to: string; subject: string; html: string;
  category: 'security' | 'service' | 'marketing';
  source: string;
}
export interface SmsMessage { to: string; text: string }

export type MessageFor<C extends Channel> =
  C extends 'app' ? AppMessage : C extends 'push' ? PushMessage : C extends 'email' ? EmailMessage : SmsMessage;
