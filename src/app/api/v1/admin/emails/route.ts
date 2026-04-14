import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';
import { z } from 'zod';
import { Resend } from 'resend';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
}

const CampaignSchema = z.object({
  type:    z.enum(['webjetos_reativacao', 'custom', 'transacional']),
  subject: z.string().min(5).max(200),
  body_html: z.string().min(10),
  // Para campanhas segmentadas
  filter:  z.object({
    plan:       z.string().optional(),
    is_legacy:  z.boolean().optional(),
    city:       z.string().optional(),
  }).optional(),
  // Para e-mail único de teste
  test_email: z.string().email().optional(),
  // Limite de envio por execução
  limit: z.number().int().min(1).max(500).default(50),
});

// ─── GET /api/v1/admin/emails ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Buscar logs de e-mail do Resend
  try {
    // Resend não tem endpoint de listagem na API pública
    // Retornamos stats calculados do backend
    const res = await fetch(`${API}/api/v1/admin/email-stats`, {
      headers: backendHeaders(req),
    });

    if (res.ok) return NextResponse.json(await res.json());

    // Fallback com estrutura esperada
    return NextResponse.json({
      campaigns: [],
      total_sent: 0,
      total_opened: 0,
      total_clicked: 0,
      resend_connected: !!process.env.RESEND_API_KEY,
    });
  } catch {
    return NextResponse.json({ campaigns: [], total_sent: 0 });
  }
}

// ─── POST /api/v1/admin/emails ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ detail: 'JSON inválido' }, { status: 400 });
  }

  const result = CampaignSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { detail: 'Dados inválidos', errors: result.error.flatten() },
      { status: 422 }
    );
  }

  const campaign = result.data;

  // ── Modo teste: enviar para um único e-mail ──
  if (campaign.test_email) {
    try {
      const { data, error } = await getResend().emails.send({
        from:    `Backfindr <noreply@backfindr.com>`,
        to:      [campaign.test_email],
        subject: `[TESTE] ${campaign.subject}`,
        html:    campaign.body_html,
      });

      if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
      return NextResponse.json({ success: true, test: true, message_id: data?.id });
    } catch (e) {
      return NextResponse.json({ detail: String(e) }, { status: 500 });
    }
  }

  // ── Campanha real: buscar destinatários do backend ──
  try {
    const params = new URLSearchParams({ size: String(campaign.limit) });
    if (campaign.filter?.plan)      params.set('filter', campaign.filter.plan);
    if (campaign.filter?.is_legacy) params.set('filter', 'legacy');

    const usersRes = await fetch(
      `${API}/api/v1/admin/users?${params.toString()}`,
      { headers: backendHeaders(req) }
    );

    if (!usersRes.ok) {
      return NextResponse.json({ detail: 'Erro ao buscar destinatários' }, { status: 500 });
    }

    const { items: users } = await usersRes.json() as { items: { email: string; name: string }[] };

    if (!users?.length) {
      return NextResponse.json({ detail: 'Nenhum destinatário encontrado' }, { status: 404 });
    }

    // Enfileira no Resend em lotes de 10
    let sent = 0;
    const errors: string[] = [];
    const BATCH = 10;

    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async user => {
          // Personalizar HTML
          const personalizedHtml = campaign.body_html
            .replace(/{{nome}}/g, user.name.split(' ')[0])
            .replace(/{{email}}/g, user.email);

          const { error } = await getResend().emails.send({
            from:    `Backfindr <noreply@backfindr.com>`,
            to:      [user.email],
            subject: campaign.subject,
            html:    personalizedHtml,
          });

          if (error) errors.push(`${user.email}: ${error.message}`);
          else sent++;
        })
      );

      // Pausa entre lotes para respeitar rate limit do Resend
      if (i + BATCH < users.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: errors.length,
      total:  users.length,
      errors: errors.slice(0, 10), // retorna até 10 erros
    });

  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
