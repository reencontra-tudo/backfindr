export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com';

// GET /api/auth/magic-link/verify?token=XXX — valida o token e autentica o usuário
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=magic_link_invalid`);
  }

  try {
    // Buscar token válido e não expirado
    const tokenResult = await query(
      `SELECT * FROM magic_link_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.redirect(`${APP_URL}/auth/login?error=magic_link_expired`);
    }

    const magicToken = tokenResult.rows[0];
    const email = magicToken.email;

    // Marcar token como usado imediatamente (uso único)
    await query(
      `UPDATE magic_link_tokens SET used = true WHERE id = $1`,
      [magicToken.id]
    );

    // Buscar ou criar usuário
    const userResult = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      // Marcar e-mail como verificado se ainda não estava
      await query(
        `UPDATE users SET is_verified = true, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
    } else {
      // Criar conta automaticamente — sem senha, e-mail verificado
      const name = email.split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const insertResult = await query(
        `INSERT INTO users (email, name, password_hash, is_verified, plan, created_at, updated_at)
         VALUES ($1, $2, '', true, 'free', NOW(), NOW())
         RETURNING id, email, name`,
        [email, name]
      );
      user = insertResult.rows[0];
    }

    // Gerar tokens JWT (mesmo padrão do login normal e Google OAuth)
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    // Redirecionar para página intermediária que salva tokens via js-cookie
    const successUrl = new URL(`${APP_URL}/auth/magic-success`);
    successUrl.searchParams.set('access_token', accessToken);
    successUrl.searchParams.set('refresh_token', refreshToken);

    return NextResponse.redirect(successUrl.toString());
  } catch (err) {
    console.error('Magic link verify error:', err);
    return NextResponse.redirect(`${APP_URL}/auth/login?error=magic_link_failed`);
  }
}
