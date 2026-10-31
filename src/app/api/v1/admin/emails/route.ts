export const dynamic = 'force-dynamic';
// Com 600 ms entre envios, 60 s comportam ~90 envios; o laço para antes do limite (ver TIME_BUDGET_MS).
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { z } from 'zod';
import { esc } from '@/lib/email';
import { deliverEmail, type SendResult } from '@/lib/emailSend';

// Limite do Resend: 2 envios por segundo. Intervalo mínimo entre inícios de envio e uma única nova tentativa
// em erro de limite de requisições (429 rate_limit_exceeded).
const MIN_SEND_INTERVAL_MS = 600;
const RATE_LIMIT_RETRY_DELAY_MS = 1000;
// Margem para a resposta caber em maxDuration: para de iniciar envios depois disso.
const TIME_BUDGET_MS = 50_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CampaignSchema = z.object({
  type:       z.enum(['webjetos_reativacao', 'custom', 'transacional']),
  subject:    z.string().min(5).max(200),
  body_html:  z.string().min(10),
  filter:     z.object({ plan: z.string().optional(), is_legacy: z.boolean().optional(), city: z.string().optional() }).optional(),
  test_email: z.string().email().optional(),
  limit:      z.number().int().min(1).max(500).default(50),
});

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    // skipped_count vem da migration 021; sem ela, lista sem essa coluna.
    let campaigns;
    try {
      campaigns = (await query(`SELECT id, type, subject, status, sent_count, failed_count, skipped_count, created_at, sent_at FROM email_campaigns ORDER BY created_at DESC LIMIT 20`)).rows;
    } catch {
      campaigns = (await query(`SELECT id, type, subject, status, sent_count, failed_count, created_at, sent_at FROM email_campaigns ORDER BY created_at DESC LIMIT 20`)).rows;
    }
    const statsRes = await query(`SELECT COUNT(*) AS total_users FROM users`);

    // Resultados por campanha e saúde do envio (migrations 020 e 021). Sem as tabelas: tracking.available = false.
    let tracking: { available: boolean; webhook_configured: boolean } = { available: false, webhook_configured: !!process.env.RESEND_WEBHOOK_SECRET };
    let health: Record<string, number | null> | null = null;
    const results: Record<string, Record<string, number>> = {};
    try {
      const perCampaign = await query(
        `WITH per_msg AS (
           SELECT m.campaign_id, m.resend_id,
                  COALESCE(bool_or(e.type = 'delivered'), false) AS delivered,
                  COALESCE(bool_or(e.type = 'bounced'), false) AS bounced,
                  COALESCE(bool_or(e.type = 'complained'), false) AS complained,
                  COALESCE(bool_or(e.type = 'opened'), false) AS opened,
                  COALESCE(bool_or(e.type = 'clicked'), false) AS clicked
             FROM email_messages m
             LEFT JOIN email_events e ON e.resend_id = m.resend_id
            WHERE m.campaign_id IS NOT NULL
            GROUP BY m.campaign_id, m.resend_id
         )
         SELECT campaign_id,
                COUNT(*)::int AS tracked,
                COUNT(*) FILTER (WHERE delivered)::int AS delivered,
                COUNT(*) FILTER (WHERE bounced)::int AS bounced,
                COUNT(*) FILTER (WHERE complained)::int AS complained,
                COUNT(*) FILTER (WHERE opened)::int AS opened,
                COUNT(*) FILTER (WHERE clicked)::int AS clicked
           FROM per_msg GROUP BY campaign_id`,
      );
      for (const r of perCampaign.rows) results[r.campaign_id as string] = r;

      const unsubs = await query(
        `SELECT substring(source from 'unsubscribe_campaign:(.*)$') AS campaign_id, COUNT(*)::int AS n
           FROM email_suppressions
          WHERE reason = 'unsubscribe' AND source LIKE 'unsubscribe_campaign:%'
          GROUP BY 1`,
      );
      for (const r of unsubs.rows) {
        const cid = r.campaign_id as string;
        results[cid] = { ...(results[cid] ?? { tracked: 0, delivered: 0, bounced: 0, complained: 0, opened: 0, clicked: 0 }), unsubscribed: r.n as number };
      }

      const h = (await query(
        `WITH recent AS (
           SELECT m.resend_id FROM email_messages m WHERE m.sent_at >= NOW() - INTERVAL '30 days'
         ), flags AS (
           SELECT r.resend_id,
                  COALESCE(bool_or(e.type = 'delivered'), false) AS delivered,
                  COALESCE(bool_or(e.type = 'bounced'), false) AS bounced,
                  COALESCE(bool_or(e.type = 'complained'), false) AS complained,
                  COUNT(e.id) AS evs
             FROM recent r LEFT JOIN email_events e ON e.resend_id = r.resend_id
            GROUP BY r.resend_id
         )
         SELECT COUNT(*)::int AS sent,
                COUNT(*) FILTER (WHERE delivered)::int AS delivered,
                COUNT(*) FILTER (WHERE bounced)::int AS bounced,
                COUNT(*) FILTER (WHERE complained)::int AS complained,
                COALESCE(SUM(evs), 0)::int AS events,
                (SELECT COUNT(*)::int FROM email_suppressions) AS suppressed_total
           FROM flags`,
      )).rows[0] as { sent: number; delivered: number; bounced: number; complained: number; events: number; suppressed_total: number };
      // Sem nenhum evento do Resend no período (webhook ainda não ligado), as taxas ficam nulas em vez de 0% enganoso.
      const hasEvents = h.events > 0 && h.sent > 0;
      health = {
        days: 30,
        sent: h.sent,
        events: h.events,
        delivery_rate: hasEvents ? h.delivered / h.sent : null,
        bounce_rate: hasEvents ? h.bounced / h.sent : null,
        complaint_rate: hasEvents ? h.complained / h.sent : null,
        suppressed_total: h.suppressed_total,
      };
      tracking = { ...tracking, available: true };
    } catch {
      // migrations 020/021 não aplicadas
    }

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({ ...c, results: results[c.id as string] ?? null })),
      stats: { total_users: parseInt(statsRes.rows[0].total_users, 10), resend_connected: !!process.env.RESEND_API_KEY },
      tracking,
      health,
    });
  } catch (e) { return NextResponse.json({ campaigns: [], stats: { total_users: 0, resend_connected: false }, tracking: { available: false, webhook_configured: false }, health: null }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const parsed = CampaignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ detail: parsed.error.issues }, { status: 400 });
  const { type, subject, body_html, filter, test_email, limit } = parsed.data;

  // Criar registro da campanha
  const campaignRes = await query(
    `INSERT INTO email_campaigns (type, subject, body_html, status, filter_json) VALUES ($1,$2,$3,'sending',$4) RETURNING id`,
    [type, subject, body_html, filter ? JSON.stringify(filter) : null]
  );
  const campaignId = campaignRes.rows[0].id;

  // Categoria de política: campanha 'custom' é marketing; 'transacional' é serviço.
  const category = type === 'custom' ? 'marketing' : 'service';

  // Se for teste, enviar só para test_email (endereço avulso: a regra só barra suprimido/conta de sistema).
  if (test_email) {
    const result = await deliverEmail({
      to: test_email,
      subject,
      html: body_html,
      category: 'service',
      source: 'campaign_test',
      campaignId,
    });
    if (result.ok) {
      await query(`UPDATE email_campaigns SET status='sent', sent_count=1, sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [campaignId]);
      return NextResponse.json({ sent: 1, failed: 0, skipped: 0, campaign_id: campaignId });
    }
    await query(`UPDATE email_campaigns SET status='failed', updated_at=NOW() WHERE id=$1`, [campaignId]);
    if (result.status === 'skipped') {
      return NextResponse.json({ detail: `Envio recusado pela regra de e-mail (${result.reason}).` }, { status: 400 });
    }
    return NextResponse.json({ detail: 'Erro ao enviar e-mail de teste' }, { status: 500 });
  }

  // Regra de uso do legado: registros legados não são base de envio em massa.
  if (filter?.is_legacy || type === 'webjetos_reativacao') {
    await query(`UPDATE email_campaigns SET status='failed', updated_at=NOW() WHERE id=$1`, [campaignId]);
    return NextResponse.json({ detail: 'Envio para registros legados não é permitido.' }, { status: 400 });
  }

  // Buscar usuários com filtros (legado e conta de sistema ficam sempre de fora)
  const conditions: string[] = ['is_legacy IS NOT TRUE', 'is_system_account IS NOT TRUE']; const params: unknown[] = []; let idx = 1;
  if (filter?.plan)      { conditions.push(`plan = $${idx}`);       params.push(filter.plan); idx++; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  const usersRes = await query(`SELECT id, email, name, is_legacy, is_system_account FROM users ${where} LIMIT $${idx}`, params);

  let sent = 0; let failed = 0; let skipped = 0; let notAttempted = 0;
  const startedAt = Date.now();
  let lastCallAt = 0;
  // Espaça só as chamadas de fato ao Resend (recusa por regra não chama e não espera).
  const pace = async () => {
    const wait = lastCallAt + MIN_SEND_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  };

  for (let i = 0; i < usersRes.rows.length; i++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      notAttempted = usersRes.rows.length - i;
      break;
    }
    const user = usersRes.rows[i];
    const personalizedHtml = body_html.replace(/{{name}}/g, esc(user.name ?? 'usuário'));
    const attempt = (): Promise<SendResult> => deliverEmail({
      to: user.email,
      subject,
      html: personalizedHtml,
      category,
      source: 'campaign',
      recipient: { id: user.id, is_legacy: user.is_legacy === true, is_system_account: user.is_system_account === true },
      campaignId,
      beforeSend: pace,
    });
    let result = await attempt();
    // Uma única nova tentativa, só para limite de requisições.
    if (!result.ok && result.status === 'failed' && result.rateLimited) {
      await sleep(RATE_LIMIT_RETRY_DELAY_MS);
      result = await attempt();
    }
    if (result.ok) sent++;
    else if (result.status === 'skipped') skipped++;
    else failed++;
  }

  // skipped_count vem da migration 021; se ela ainda não foi aplicada, grava só os contadores antigos.
  try {
    await query(`UPDATE email_campaigns SET status='sent', sent_count=$1, failed_count=$2, skipped_count=$3, sent_at=NOW(), updated_at=NOW() WHERE id=$4`, [sent, failed, skipped, campaignId]);
  } catch {
    await query(`UPDATE email_campaigns SET status='sent', sent_count=$1, failed_count=$2, sent_at=NOW(), updated_at=NOW() WHERE id=$3`, [sent, failed, campaignId]);
  }
  return NextResponse.json({ sent, failed, skipped, ...(notAttempted ? { not_attempted: notAttempted } : {}), campaign_id: campaignId });
}
