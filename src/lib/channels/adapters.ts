// Um adaptador por canal, reaproveitando o que já existe. Nenhum é chamado por fluxo algum nesta fase.
import { query } from '../db';
import { sendPushToUser } from '../pushNotification';
import { deliverEmail } from '../emailSend';
import type { AppMessage, ChannelResult, EmailMessage, PushMessage, SmsMessage } from './types';

export async function sendApp(m: AppMessage): Promise<ChannelResult> {
  await query(
    `INSERT INTO notifications (user_id, title, message, type, url, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
    [m.userId, m.title, m.message, m.type, m.url ?? null],
  );
  return { channel: 'app', status: 'sent' };
}

export async function sendPush(m: PushMessage): Promise<ChannelResult> {
  await sendPushToUser(m.userId, { title: m.title, body: m.body, url: m.url, tag: m.tag });
  return { channel: 'push', status: 'sent' };
}

export async function sendEmail(m: EmailMessage): Promise<ChannelResult> {
  const r = await deliverEmail({ to: m.to, subject: m.subject, html: m.html, category: m.category, source: m.source });
  if (r.ok) return { channel: 'email', status: 'sent', detail: r.id };
  if (r.status === 'skipped') return { channel: 'email', status: 'skipped', reason: String(r.reason) };
  return { channel: 'email', status: 'failed', error: r.error };
}

/** SMS está desligado: nunca envia nem custa nada. Ver CHANNEL_ENABLED. */
export async function sendSms(_m: SmsMessage): Promise<ChannelResult> {
  return { channel: 'sms', status: 'skipped', reason: 'canal desativado' };
}
