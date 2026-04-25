/**
 * pushNotification.ts
 * Lógica server-side de disparo de Web Push Notifications via VAPID.
 * Utiliza a biblioteca web-push.
 *
 * Variáveis de ambiente necessárias (configurar na Vercel):
 *   VAPID_PUBLIC_KEY   — chave pública VAPID
 *   VAPID_PRIVATE_KEY  — chave privada VAPID
 *   VAPID_SUBJECT      — mailto: ou URL do site (ex: mailto:suporte@backfindr.com)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — mesma chave pública (exposta ao browser)
 */

import webpush from 'web-push';
import { query } from './db';

// ─── Configuração VAPID ───────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     ?? 'mailto:suporte@backfindr.com';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not configured — push notifications disabled');
    return;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  actions?: Array<{ action: string; title: string }>;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  auth: string | null;
  p256dh: string | null;
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Envia push notification para todos os dispositivos de um usuário.
 * Falhas individuais são silenciadas (subscription expirada → removida automaticamente).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureVapid();
  if (!vapidConfigured) return;

  let rows: PushSubscriptionRow[] = [];
  try {
    const result = await query(
      `SELECT id, user_id, endpoint, auth, p256dh
       FROM push_subscriptions
       WHERE user_id = $1`,
      [userId]
    );
    rows = result.rows as PushSubscriptionRow[];
  } catch (err) {
    console.error('[push] Failed to fetch subscriptions:', err);
    return;
  }

  if (rows.length === 0) return;

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    rows.map(async (row) => {
      const subscription: webpush.PushSubscription = {
        endpoint: row.endpoint,
        keys: {
          auth:   row.auth   ?? '',
          p256dh: row.p256dh ?? '',
        },
      };
      try {
        await webpush.sendNotification(subscription, payloadStr);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 ou 410 = subscription expirada/inválida → remover
        if (statusCode === 404 || statusCode === 410) {
          await query(
            `DELETE FROM push_subscriptions WHERE id = $1`,
            [row.id]
          ).catch(() => {});
        } else {
          console.warn(`[push] Failed to send to ${row.endpoint.slice(0, 40)}…:`, statusCode);
        }
      }
    })
  );
}

/**
 * Envia push notification para múltiplos usuários em paralelo.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)));
}

// ─── Helpers de payload por evento ───────────────────────────────────────────

export function matchPayload(matchId: string, objectTitle: string, score: number): PushPayload {
  return {
    title: '🔍 Match encontrado!',
    body: `Possível correspondência para "${objectTitle}" com ${Math.round(score * 100)}% de similaridade.`,
    url: `/dashboard/matches`,
    tag: `match-${matchId}`,
    actions: [{ action: 'view', title: 'Ver match' }],
  };
}

export function scanPayload(objectTitle: string, objectId: string): PushPayload {
  return {
    title: '📱 QR Code escaneado!',
    body: `Alguém escaneou o QR Code do seu objeto "${objectTitle}".`,
    url: `/dashboard/objects/${objectId}`,
    tag: `scan-${objectId}`,
    actions: [{ action: 'view', title: 'Ver objeto' }],
  };
}

export function chatPayload(senderName: string, matchId: string, preview: string): PushPayload {
  return {
    title: `💬 Nova mensagem de ${senderName}`,
    body: preview.length > 80 ? preview.slice(0, 77) + '…' : preview,
    url: `/dashboard/matches/${matchId}`,
    tag: `chat-${matchId}`,
    actions: [{ action: 'reply', title: 'Responder' }],
  };
}
