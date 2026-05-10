export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { z } from 'zod';
import { Resend } from 'resend';

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? 're_placeholder'); }

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
    const [campaignsRes, statsRes] = await Promise.all([
      query(`SELECT id, type, subject, status, sent_count, failed_count, created_at, sent_at FROM email_campaigns ORDER BY created_at DESC LIMIT 20`),
      query(`SELECT COUNT(*) AS total_users FROM users`),
    ]);
    return NextResponse.json({
      campaigns: campaignsRes.rows,
      stats: { total_users: parseInt(statsRes.rows[0].total_users, 10), resend_connected: !!process.env.RESEND_API_KEY },
    });
  } catch (e) { return NextResponse.json({ campaigns: [], stats: { total_users: 0, resend_connected: false } }); }
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

  // Se for teste, enviar só para test_email
  if (test_email) {
    try {
      const resend = getResend();
      await resend.emails.send({ from: 'Backfindr <noreply@backfindr.com>', to: [test_email], subject, html: body_html });
      await query(`UPDATE email_campaigns SET status='sent', sent_count=1, sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [campaignId]);
      return NextResponse.json({ sent: 1, failed: 0, campaign_id: campaignId });
    } catch (e) {
      await query(`UPDATE email_campaigns SET status='failed', updated_at=NOW() WHERE id=$1`, [campaignId]);
      return NextResponse.json({ detail: 'Erro ao enviar e-mail de teste' }, { status: 500 });
    }
  }

  // Buscar usuários com filtros
  const conditions: string[] = []; const params: unknown[] = []; let idx = 1;
  if (filter?.plan)      { conditions.push(`plan = $${idx}`);       params.push(filter.plan); idx++; }
  if (filter?.is_legacy) { conditions.push(`is_legacy = $${idx}`);  params.push(filter.is_legacy); idx++; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);
  const usersRes = await query(`SELECT id, email, name FROM users ${where} LIMIT $${idx}`, params);

  let sent = 0; let failed = 0;
  const resend = getResend();
  for (const user of usersRes.rows) {
    try {
      const personalizedHtml = body_html.replace(/{{name}}/g, user.name ?? 'usuário');
      await resend.emails.send({ from: 'Backfindr <noreply@backfindr.com>', to: [user.email], subject, html: personalizedHtml });
      sent++;
    } catch { failed++; }
  }

  await query(`UPDATE email_campaigns SET status='sent', sent_count=$1, failed_count=$2, sent_at=NOW(), updated_at=NOW() WHERE id=$3`, [sent, failed, campaignId]);
  return NextResponse.json({ sent, failed, campaign_id: campaignId });
}
