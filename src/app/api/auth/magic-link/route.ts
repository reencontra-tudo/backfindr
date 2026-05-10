export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com';
const FROM_EMAIL = 'noreply@backfindr.com.br';
const TOKEN_EXPIRES_MINUTES = 15;

// POST /api/auth/magic-link — solicita envio do magic link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }

    // Garantir que a tabela de tokens existe
    await query(`
      CREATE TABLE IF NOT EXISTS magic_link_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email      VARCHAR(255) NOT NULL,
        token      VARCHAR(128) NOT NULL UNIQUE,
        used       BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_token ON magic_link_tokens(token)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens(email)`);

    // Invalidar tokens anteriores não usados para este e-mail
    await query(
      `UPDATE magic_link_tokens SET used = true WHERE email = $1 AND used = false`,
      [email]
    );

    // Gerar novo token seguro
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRES_MINUTES * 60 * 1000);

    await query(
      `INSERT INTO magic_link_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
      [email, token, expiresAt]
    );

    // Verificar se usuário já existe para personalizar o e-mail
    const userResult = await query('SELECT name FROM users WHERE email = $1', [email]);
    const userName = userResult.rows[0]?.name?.split(' ')[0] || null;
    const greeting = userName ? `Olá, ${userName}!` : 'Olá!';
    const isNewUser = userResult.rows.length === 0;

    const magicUrl = `${APP_URL}/api/auth/magic-link/verify?token=${token}`;

    // Enviar e-mail
    const emailResult = await resend.emails.send({
      from: `Backfindr <${FROM_EMAIL}>`,
      to: email,
      subject: isNewUser ? 'Crie sua conta no Backfindr' : 'Seu link de acesso ao Backfindr',
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isNewUser ? 'Crie sua conta' : 'Seu link de acesso'}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#111318;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#14b8a6;border-radius:10px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:18px;">📍</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="color:#fff;font-size:16px;font-weight:700;">Backfindr</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px;">${greeting}</p>
              <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 28px;line-height:1.6;">
                ${isNewUser
                  ? 'Clique no botão abaixo para criar sua conta gratuita no Backfindr e começar a recuperar seus objetos perdidos.'
                  : 'Clique no botão abaixo para entrar na sua conta. Nenhuma senha necessária.'}
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${magicUrl}" style="display:inline-block;background:#14b8a6;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.01em;">
                      ${isNewUser ? 'Criar minha conta' : 'Entrar no Backfindr'} →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:24px 0 0;text-align:center;line-height:1.6;">
                Este link expira em ${TOKEN_EXPIRES_MINUTES} minutos e só pode ser usado uma vez.<br/>
                Se você não solicitou este acesso, ignore este e-mail.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;text-align:center;">
                Backfindr — Recupere o que é seu.<br/>
                <a href="${APP_URL}" style="color:rgba(20,184,166,0.6);text-decoration:none;">${APP_URL.replace('https://', '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      return NextResponse.json({ error: 'Erro ao enviar e-mail. Tente novamente.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, isNewUser });
  } catch (err) {
    console.error('Magic link error:', err);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
