export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { query } from '@/lib/db';
import { addSuppressionByHash, hashEmail, type SuppressionReason } from '@/lib/emailPolicy';

// Webhook do Resend (assinatura Svix verificada com resend.webhooks.verify, do SDK; o SDK usa a lib svix por dentro).
//
// INERTE sem RESEND_WEBHOOK_SECRET: responde 401 e não grava nada. Assinatura ausente ou inválida: 401, nada gravado.
//
// Eventos gravados em email_events: delivered, bounced, complained, delivery_delayed, opened, clicked. Os demais
// (sent, failed, suppressed, contatos, domínios...) são ignorados com 200.
// Idempotente: unique (resend_id, type, occurred_at) + ON CONFLICT DO NOTHING; reentrega não duplica.
// bounce permanente e complaint entram em email_suppressions (reason 'bounce' | 'complaint').
// Não grava corpo, assunto, endereço, link nem a mensagem de erro do servidor de destino.

const HANDLED: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delivery_delayed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
};

interface EventLike {
  type: string;
  created_at?: string;
  data?: { email_id?: string; created_at?: string; to?: string[]; bounce?: { type?: string; subType?: string } };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const payload = await request.text();

  let event: EventLike;
  try {
    // A chave da API não é usada na verificação.
    const resend = new Resend(process.env.RESEND_API_KEY || 'verify-only');
    event = resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret }) as unknown as EventLike;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const type = HANDLED[event.type];
  const resendId = event.data?.email_id;
  const occurredAtRaw = event.created_at ?? event.data?.created_at;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : null;
  if (!type || !resendId || !occurredAt || Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Só campos permitidos.
  const safePayload: Record<string, unknown> = { type, email_id: resendId, created_at: occurredAt.toISOString() };
  if (type === 'bounced' && event.data?.bounce) {
    safePayload.bounce = { type: event.data.bounce.type ?? null, subType: event.data.bounce.subType ?? null };
  }

  try {
    const inserted = await query(
      `INSERT INTO email_events (resend_id, type, occurred_at, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (resend_id, type, occurred_at) DO NOTHING
       RETURNING id`,
      [resendId, type, occurredAt.toISOString(), JSON.stringify(safePayload)],
    );
    const duplicate = (inserted.rowCount ?? 0) === 0;

    // Supressão roda mesmo em reentrega: é idempotente e cobre falha anterior entre o evento e a supressão.
    let reason: SuppressionReason | null = null;
    if (type === 'complained') reason = 'complaint';
    else if (type === 'bounced' && String(event.data?.bounce?.type ?? '').toLowerCase() === 'permanent') reason = 'bounce';

    if (reason) {
      const msg = await query(`SELECT to_email_hash, user_id FROM email_messages WHERE resend_id = $1`, [resendId]);
      const row = msg.rows[0] as { to_email_hash: string | null; user_id: string | null } | undefined;
      // Sem a linha (ainda) em email_messages, usa o endereço do próprio evento só para calcular o hash.
      const emailHash = row?.to_email_hash ?? (event.data?.to?.[0] ? hashEmail(event.data.to[0]) : null);
      if (emailHash) {
        await addSuppressionByHash({ emailHash, userId: row?.user_id ?? null, reason, source: 'resend_webhook' });
      } else {
        console.warn('[webhook resend] evento de supressão sem como calcular o hash (EMAIL_HASH_SECRET ausente?)');
      }
    }

    return NextResponse.json({ ok: true, duplicate });
  } catch (err) {
    // 500 faz o Resend reentregar (ex.: migration 021 ainda não aplicada).
    console.error('[webhook resend] falha ao gravar:', (err as { code?: string })?.code ?? 'erro');
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
