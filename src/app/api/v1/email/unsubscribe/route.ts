export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { addSuppressionByHash, verifyUnsubscribeToken } from '@/lib/emailPolicy';

// Descadastro público (sem login). Token assinado em ?t=; idempotente.
//   GET  — link do rodapé: grava e mostra uma página em português.
//   POST — one-click (RFC 8058): o cliente de e-mail envia "List-Unsubscribe=One-Click"; grava e responde JSON.
// Grava em email_suppressions (reason 'unsubscribe'). Vale para e-mail de serviço e de marketing; e-mail de
// segurança (redefinição de senha, magic link) não é afetado.

type Outcome = 'ok' | 'invalid' | 'expired' | 'unavailable';

async function apply(token: string | null): Promise<Outcome> {
  const check = verifyUnsubscribeToken(token);
  if (!check.ok) return check.error;
  try {
    await addSuppressionByHash({ emailHash: check.emailHash, userId: check.userId, reason: 'unsubscribe', source: check.campaignId ? `unsubscribe_campaign:${check.campaignId}` : 'unsubscribe_link' });
    if (check.userId) {
      try {
        await query(
          `INSERT INTO email_preferences (user_id, marketing_opt_in, source, updated_at)
           VALUES ($1, FALSE, 'unsubscribe', NOW())
           ON CONFLICT (user_id) DO UPDATE SET marketing_opt_in = FALSE, source = 'unsubscribe', updated_at = NOW()`,
          [check.userId],
        );
      } catch {
        // Preferências são complementares: a supressão acima é o que vale.
      }
    }
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

const PAGES: Record<Outcome, { status: number; title: string; text: string }> = {
  ok: {
    status: 200,
    title: 'Inscrição cancelada',
    text: 'Pronto. Você não receberá mais e-mails do Backfindr neste endereço, exceto os de segurança que você mesmo pedir, como a redefinição de senha.',
  },
  invalid: { status: 400, title: 'Link inválido', text: 'Este link de cancelamento não é válido. Use o link de um e-mail recente do Backfindr.' },
  expired: { status: 400, title: 'Link expirado', text: 'Este link de cancelamento expirou. Use o link de um e-mail mais recente do Backfindr.' },
  unavailable: { status: 503, title: 'Tente de novo', text: 'Não foi possível concluir agora. Tente novamente em alguns minutos.' },
};

function page(outcome: Outcome): NextResponse {
  const p = PAGES[outcome];
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${p.title} — Backfindr</title></head>
<body style="margin:0;background:#0a0a0f;color:#e2e8f0;font-family:Arial,sans-serif;">
<main style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 12px;">${p.title}</h1>
<p style="font-size:15px;line-height:1.5;color:#94a3b8;margin:0 0 24px;">${p.text}</p>
<a href="https://www.backfindr.com" style="color:#2dd4bf;font-size:14px;">Ir para o Backfindr</a>
</main></body></html>`;
  return new NextResponse(html, {
    status: p.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

export async function GET(request: NextRequest) {
  return page(await apply(request.nextUrl.searchParams.get('t')));
}

export async function POST(request: NextRequest) {
  const outcome = await apply(request.nextUrl.searchParams.get('t'));
  return NextResponse.json(
    outcome === 'ok' ? { ok: true } : { ok: false, error: outcome },
    { status: PAGES[outcome].status, headers: { 'cache-control': 'no-store' } },
  );
}
