export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { esc } from '@/lib/email';
import { deliverEmail } from '@/lib/emailSend';
import { consumeEmailRequestSlots } from '@/lib/sendThrottle';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return errorResponse('Email is required', 400);
    }

    // Limite por IP e por e-mail ANTES de consultar o banco: conta existente ou não, a resposta é a mesma, e nenhum
    // token é sobrescrito nem e-mail enviado quando o limite estoura.
    if (typeof email !== 'string') {
      return errorResponse('Email is required', 400);
    }
    if (!(await consumeEmailRequestSlots('forgot_password', request.headers, email))) {
      return errorResponse('Too many requests. Please wait a few minutes and try again.', 429);
    }

    // Verificar se o usuário existe
    const result = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Sempre retornar sucesso para não vazar informações
    if (result.rows.length === 0) {
      return successResponse({ message: 'If this email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];

    // Gerar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salvar token no banco
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3`,
      [user.id, resetTokenHash, expiresAt]
    );

    // Em produção, enviar email via Resend
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app'}/auth/reset-password?token=${resetToken}`;

    // E-mail de segurança pedido pelo próprio usuário: vale também para legado (precisa trocar a senha).
    // O resultado não altera a resposta (evita revelar se o e-mail existe).
    await deliverEmail({
      to: user.email,
      subject: 'Redefinição de senha — Backfindr',
      category: 'security',
      source: 'password_reset',
      recipient: { id: user.id },
      html: `
        <h2>Redefinição de senha</h2>
        <p>Olá, ${esc(user.name)}!</p>
        <p>Você solicitou a redefinição de sua senha. Clique no link abaixo para criar uma nova senha:</p>
        <a href="${resetUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">
          Redefinir senha
        </a>
        <p>Este link expira em 1 hora.</p>
        <p>Se você não solicitou isso, ignore este email.</p>
      `,
    });

    return successResponse({ message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
