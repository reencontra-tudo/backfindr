import { query } from '@/lib/db';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SocialPostObject {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  category: string;
  unique_code?: string;
  qr_code?: string;
  location?: { address?: string } | null;
  images?: string[];
  reward_amount?: number | null;
  reward_description?: string | null;
}

export type SocialChannel = 'telegram' | 'whatsapp_link' | 'twitter' | 'facebook';

// ─── Labels e emojis ─────────────────────────────────────────────────────────
const STATUS_EMOJI: Record<string, string> = {
  lost: '🔴 Perdido',
  found: '🟢 Achado',
  stolen: '🟠 Roubado',
  returned: '✅ Recuperado',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular 📱', wallet: 'Carteira 👛', keys: 'Chaves 🔑',
  bag: 'Bolsa/Mochila 🎒', pet: 'Pet 🐾', bike: 'Bicicleta 🚲',
  vehicle: 'Veículo 🚗', document: 'Documento 📄', jewelry: 'Joia 💍',
  electronics: 'Eletrônico 💻', clothing: 'Roupa 👕', other: 'Outro 📦',
};

// ─── Buscar configuração social ───────────────────────────────────────────────
async function getSetting(key: string): Promise<string> {
  try {
    const res = await query(`SELECT value FROM social_settings WHERE key = $1`, [key]);
    return res.rows[0]?.value ?? '';
  } catch {
    return '';
  }
}

// ─── Gerar texto do post a partir do template ─────────────────────────────────
export function buildPostText(obj: SocialPostObject, template: string, appUrl: string): string {
  const url = `${appUrl}/objeto/${obj.unique_code ?? obj.qr_code}`;
  const statusEmoji = STATUS_EMOJI[obj.status] ?? obj.status;
  const category = CATEGORY_LABEL[obj.category] ?? obj.category;
  const location = obj.location?.address ?? '';
  const rewardLine = obj.reward_amount && obj.reward_amount > 0
    ? `💰 Recompensa: R$ ${obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : '';

  return template
    .replace(/{status_emoji}/g, statusEmoji)
    .replace(/{title}/g, obj.title)
    .replace(/{category}/g, category)
    .replace(/{location}/g, location || 'Localização não informada')
    .replace(/{reward_line}/g, rewardLine)
    .replace(/{reward}/g, rewardLine)
    .replace(/{url}/g, url)
    .replace(/\n{3,}/g, '\n\n') // remover linhas em branco extras
    .trim();
}

// ─── Enfileirar posts para todos os canais ativos ─────────────────────────────
export async function enqueueSocialPosts(obj: SocialPostObject): Promise<void> {
  try {
    const autoEnabled = await getSetting('auto_post_enabled');
    if (autoEnabled !== 'true') return;

    const template = await getSetting('post_template') ||
      '🔍 *{status_emoji} {title}*\n\n📂 Categoria: {category}\n📍 {location}\n{reward_line}\n\n🔗 Ver detalhes: {url}\n\n_Registrado no Backfindr_';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';
    const postText = buildPostText(obj, template, appUrl);
    const imageUrl = obj.images?.[0] ?? null;
    const objectUrl = `${appUrl}/objeto/${obj.unique_code ?? obj.qr_code}`;

    const channels: SocialChannel[] = [];

    // Telegram
    const telegramEnabled = await getSetting('telegram_enabled');
    if (telegramEnabled === 'true') channels.push('telegram');

    // WhatsApp (apenas link — não há API oficial)
    const whatsappEnabled = await getSetting('whatsapp_enabled');
    if (whatsappEnabled === 'true') channels.push('whatsapp_link');

    if (channels.length === 0) return;

    for (const channel of channels) {
      await query(
        `INSERT INTO social_posts (object_id, channel, status, post_text, post_url, image_url, scheduled_for)
         VALUES ($1, $2, 'pending', $3, $4, $5, NOW())`,
        [obj.id, channel, postText, objectUrl, imageUrl]
      );
    }
  } catch (err) {
    // Não bloquear o cadastro do objeto se a fila falhar
    console.error('[socialPost] enqueueSocialPosts error:', err);
  }
}

// ─── Processar fila — chamado pelo cron ou manualmente ───────────────────────
export async function processSocialQueue(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Buscar posts pendentes (até 20 por vez, ordenados por scheduled_for)
    const pending = await query(
      `SELECT sp.*, o.title, o.qr_code, o.images
       FROM social_posts sp
       JOIN objects o ON o.id = sp.object_id
       WHERE sp.status = 'pending'
         AND sp.scheduled_for <= NOW()
         AND sp.retry_count < 3
       ORDER BY sp.scheduled_for ASC
       LIMIT 20`
    );

    for (const row of pending.rows) {
      const success = await dispatchPost(row);
      if (success) {
        await query(
          `UPDATE social_posts SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        processed++;
      } else {
        const newRetry = (row.retry_count ?? 0) + 1;
        const newStatus = newRetry >= 3 ? 'failed' : 'pending';
        // Reagendar com backoff exponencial (5min, 15min, 45min)
        const backoffMinutes = Math.pow(3, newRetry) * 5;
        await query(
          `UPDATE social_posts
           SET status = $1, retry_count = $2,
               scheduled_for = NOW() + INTERVAL '${backoffMinutes} minutes',
               updated_at = NOW()
           WHERE id = $3`,
          [newStatus, newRetry, row.id]
        );
        errors++;
      }
    }
  } catch (err) {
    console.error('[socialPost] processSocialQueue error:', err);
  }

  return { processed, errors };
}

// ─── Dispatcher por canal ─────────────────────────────────────────────────────
async function dispatchPost(row: Record<string, unknown>): Promise<boolean> {
  const channel = row.channel as string;

  try {
    if (channel === 'telegram') {
      return await sendTelegram(row);
    }
    if (channel === 'whatsapp_link') {
      // WhatsApp não tem API de envio — apenas marca como "sent" (link gerado)
      return true;
    }
    // Canais futuros (twitter, facebook, instagram) — marcar como skipped por ora
    await query(
      `UPDATE social_posts SET status = 'skipped', updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
    return true;
  } catch (err) {
    await query(
      `UPDATE social_posts SET error_message = $1, updated_at = NOW() WHERE id = $2`,
      [String(err), row.id]
    );
    return false;
  }
}

// ─── Envio via Telegram Bot API ───────────────────────────────────────────────
async function sendTelegram(row: Record<string, unknown>): Promise<boolean> {
  const botToken = await getSetting('telegram_bot_token');
  const channelId = await getSetting('telegram_channel_id');

  if (!botToken || !channelId) {
    await query(
      `UPDATE social_posts SET error_message = 'Telegram não configurado (bot_token ou channel_id ausente)', updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
    return false;
  }

  const text = row.post_text as string;
  const imageUrl = row.image_url as string | null;

  let apiUrl: string;
  let body: Record<string, unknown>;

  if (imageUrl) {
    // Enviar com foto
    apiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    body = {
      chat_id: channelId,
      photo: imageUrl,
      caption: text,
      parse_mode: 'Markdown',
    };
  } else {
    // Enviar apenas texto
    apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    body = {
      chat_id: channelId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    };
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    await query(
      `UPDATE social_posts SET error_message = $1, updated_at = NOW() WHERE id = $2`,
      [`Telegram API ${res.status}: ${errBody}`, row.id]
    );
    return false;
  }

  return true;
}
