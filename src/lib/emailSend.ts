// Ponto único de envio de e-mail do Backfindr (Resend).
//
// Todo envio passa por aqui: aplica canSendEmail, acrescenta List-Unsubscribe (service e marketing) e Reply-To
// (se EMAIL_REPLY_TO existir), lê { data, error } do Resend, grava o id da mensagem em email_messages e devolve
// um resultado tipado. Recusa por regra é 'skipped' (não é falha); erro do Resend é 'failed' (nunca sucesso).
import { Resend } from 'resend';
import { query } from '@/lib/db';
import {
  canSendEmail,
  createUnsubscribeToken,
  hashEmail,
  type EmailCategory,
  type EmailRecipient,
  type SkipReason,
} from '@/lib/emailPolicy';

export const FROM_ADDRESS = 'Backfindr <noreply@backfindr.com.br>';

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; status: 'skipped'; reason: SkipReason }
  /** rateLimited: o Resend recusou por limite de requisições (vale tentar de novo); cota diária/mensal não conta. */
  | { ok: false; status: 'failed'; error: string; rateLimited?: boolean };

export interface DeliverOptions {
  to: string;
  subject: string;
  html: string;
  category: EmailCategory;
  /** Origem do envio, ex.: 'welcome', 'campaign', 'password_reset'. */
  source: string;
  /** Dados já conhecidos do usuário (evita consulta). Sem flags, a regra consulta users pelo e-mail. */
  recipient?: Omit<EmailRecipient, 'email'>;
  campaignId?: string | null;
  lifecycleEvent?: string | null;
  /** Chamado logo antes da chamada ao Resend (só se a regra permitiu o envio). Serve para espaçar envios em lote. */
  beforeSend?: () => Promise<void>;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com').replace(/\/+$/, '');
}

export function unsubscribeUrl(token: string): string {
  return `${appUrl()}/api/v1/email/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** Acrescenta o link de descadastro antes de </body> (ou no fim, se o HTML não tiver body). */
export function withUnsubscribeFooter(html: string, url: string): string {
  const footer =
    `<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#94a3b8;font-family:Arial,sans-serif;">` +
    `Não quer mais receber e-mails do Backfindr? ` +
    `<a href="${url}" style="color:#94a3b8;text-decoration:underline;">Cancelar inscrição</a></p>`;
  const i = html.lastIndexOf('</body>');
  return i === -1 ? html + footer : html.slice(0, i) + footer + html.slice(i);
}

export async function deliverEmail(opts: DeliverOptions): Promise<SendResult> {
  // Nunca lança: quem chama (cadastro, crons) não pode cair por causa de e-mail.
  try {
    return await deliver(opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'exceção';
    console.error(`[email] erro inesperado (origem=${opts.source}):`, msg);
    return { ok: false, status: 'failed', error: msg };
  }
}

async function deliver(opts: DeliverOptions): Promise<SendResult> {
  const decision = await canSendEmail({ email: opts.to, ...opts.recipient }, opts.category);
  if (!decision.allowed) {
    // Sem endereço no log.
    console.log(`[email] ignorado (${decision.reason}) categoria=${opts.category} origem=${opts.source}`);
    return { ok: false, status: 'skipped', reason: decision.reason };
  }

  const headers: Record<string, string> = {};
  let html = opts.html;
  if (opts.category !== 'security') {
    const token = createUnsubscribeToken(opts.to, decision.userId, opts.campaignId ?? null);
    if (token) {
      const url = unsubscribeUrl(token);
      headers['List-Unsubscribe'] = `<${url}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      html = withUnsubscribeFooter(html, url);
    } else {
      console.warn('[email] EMAIL_HASH_SECRET ausente: e-mail sai sem link de descadastro');
    }
  }

  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  let id: string;
  try {
    if (opts.beforeSend) await opts.beforeSend();
    const resend = new Resend(process.env.RESEND_API_KEY ?? '');
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [opts.to],
      subject: opts.subject,
      html,
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    if (error || !data?.id) {
      const msg = error ? `${error.name ?? 'erro'}: ${error.message ?? ''}`.trim() : 'resposta sem id';
      console.error(`[email] Resend recusou o envio (origem=${opts.source}):`, msg);
      const rateLimited = !!error && (error.name === 'rate_limit_exceeded' || (error.statusCode === 429 && !/quota/.test(error.name ?? '')));
      return { ok: false, status: 'failed', error: msg, ...(rateLimited ? { rateLimited: true } : {}) };
    }
    id = data.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'exceção';
    console.error(`[email] exceção no envio (origem=${opts.source}):`, msg);
    return { ok: false, status: 'failed', error: msg };
  }

  try {
    await query(
      `INSERT INTO email_messages (resend_id, user_id, to_email_hash, category, source, campaign_id, lifecycle_event, subject)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (resend_id) DO NOTHING`,
      [
        id,
        decision.userId,
        hashEmail(opts.to),
        opts.category,
        opts.source,
        opts.campaignId ?? null,
        opts.lifecycleEvent ?? null,
        opts.subject,
      ],
    );
  } catch (err) {
    // O e-mail já saiu: falha ao registrar não vira falha de envio (ex.: migration 021 ainda não aplicada).
    console.error('[email] não foi possível gravar email_messages:', (err as { code?: string })?.code ?? 'erro');
  }

  return { ok: true, id };
}
