export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';

// POST /api/auth/magic-link/verify — valida o token e retorna JWT
// Usa POST para resistir ao pre-fetch automático de clientes de e-mail (iCloud, Gmail)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body?.token;

    if (!token) {
      return NextResponse.json(
        { message: 'Token não informado.' },
        { status: 400 }
      );
    }

    // Buscar token válido e não expirado
    const tokenResult = await query(
      `SELECT * FROM magic_link_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { message: 'Este link já foi usado ou expirou. Solicite um novo.' },
        { status: 400 }
      );
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
        `INSERT INTO users (email, name, is_verified, plan, created_at, updated_at)
         VALUES ($1, $2, true, 'free', NOW(), NOW())
         RETURNING id, email, name`,
        [email, name]
      );
      user = insertResult.rows[0];
    }

    // Gerar tokens JWT (mesmo padrão do login normal e Google OAuth)
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
    });
  } catch (err) {
    console.error('Magic link verify error:', err);
    return NextResponse.json(
      { message: 'Erro interno. Tente novamente.' },
      { status: 500 }
    );
  }
}

// GET mantido para compatibilidade — redireciona para a página de confirmação
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com';
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=magic_link_invalid`);
  }

  // Redirecionar para a página de confirmação que fará o POST
  // Isso evita que o pre-fetch do iCloud consuma o token via GET
  const confirmUrl = new URL(`${APP_URL}/auth/magic-confirm`);
  confirmUrl.searchParams.set('token', token);
  return NextResponse.redirect(confirmUrl.toString());
}
