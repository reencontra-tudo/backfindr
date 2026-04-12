import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=facebook_auth_failed`);
  }

  try {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${appUrl}/api/auth/callback/facebook`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=facebook_not_configured`);
    }

    // Trocar código por access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `client_secret=${clientSecret}&code=${code}`
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=facebook_token_failed`);
    }

    // Buscar dados do usuário
    const userResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );
    const userData = await userResponse.json();

    if (!userData.id) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=facebook_user_failed`);
    }

    const email = userData.email || `fb_${userData.id}@backfindr.local`;
    const name = userData.name || 'Usuário Facebook';

    // Verificar se usuário já existe
    let userResult = await query(
      'SELECT id, email, name FROM users WHERE email = $1 OR facebook_id = $2',
      [email, userData.id]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      // Atualizar facebook_id se necessário
      await query(
        'UPDATE users SET facebook_id = $1, updated_at = NOW() WHERE id = $2',
        [userData.id, user.id]
      );
    } else {
      // Criar novo usuário
      const insertResult = await query(
        `INSERT INTO users (email, name, facebook_id, is_verified, plan, created_at, updated_at)
         VALUES ($1, $2, $3, true, 'free', NOW(), NOW())
         RETURNING id, email, name`,
        [email, name, userData.id]
      );
      user = insertResult.rows[0];
    }

    // Gerar tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    // Redirecionar para o dashboard com tokens
    const redirectUrl = new URL(`${appUrl}/auth/callback`);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);
    redirectUrl.searchParams.set('provider', 'facebook');

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Facebook OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/auth/login?error=facebook_auth_error`);
  }
}
