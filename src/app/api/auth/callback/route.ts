export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';
import { sendWelcomeEmail } from '@/lib/email';
import { awaitSends } from '@/lib/awaitSends';
import { setAuthCookies } from '@/lib/authCookies';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=oauth_denied`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=google_not_configured`);
    }

    // Trocar código por access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Google token error:', JSON.stringify(tokenData));
      console.error('redirect_uri used:', redirectUri);
      console.error('appUrl:', appUrl);
      console.error('code length:', code?.length);
      const errorDetail = encodeURIComponent(JSON.stringify(tokenData));
      const usedRedirectUri = encodeURIComponent(redirectUri);
      return NextResponse.redirect(`${appUrl}/auth/login?error=google_token_failed&detail=${errorDetail}&used_uri=${usedRedirectUri}`);
    }

    // Buscar dados do usuário
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    if (!userData.id) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=google_user_failed`);
    }

    const email = userData.email;
    const name = userData.name || 'Usuário Google';
    const googleId = userData.id;
    const avatarUrl = userData.picture;

    if (!email) {
      return NextResponse.redirect(`${appUrl}/auth/login?error=google_no_email`);
    }

    // Verificar se usuário já existe
    const userResult = await query(
      'SELECT id, email, name FROM users WHERE email = $1 OR google_id = $2',
      [email, googleId]
    );

    let user;
    let isNewUser = false;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      await query(
        'UPDATE users SET google_id = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3',
        [googleId, avatarUrl, user.id]
      );
    } else {
      const insertResult = await query(
        `INSERT INTO users (email, name, google_id, avatar_url, is_verified, plan, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, 'free', NOW(), NOW())
         RETURNING id, email, name`,
        [email, name, googleId, avatarUrl]
      );
      user = insertResult.rows[0];
      isNewUser = true;
    }

    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    // Disparar e-mail de boas-vindas para novos usuários (a rota espera o envio terminar antes de redirecionar)
    if (isNewUser) {
      await awaitSends([
        sendWelcomeEmail({ name: user.name, email: user.email }).catch((err) => {
          console.warn('[auth] Falha ao enviar e-mail de boas-vindas para:', user.email, err);
        }),
      ]);
    }

    // Os tokens vão em Set-Cookie na própria resposta do redirect, nunca na URL (a URL é capturada
    // por analytics, gravação de sessão, logs e histórico). A página de sucesso só lê os cookies.
    const successUrl = new URL(`${appUrl}/auth/google-success`);
    // Apenas novos usuários devem ver o WelcomeModal
    if (isNewUser) successUrl.searchParams.set('new', '1');
    const response = NextResponse.redirect(successUrl.toString());
    setAuthCookies(response, { accessToken, refreshToken });
    return response;
  } catch (err) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(`${appUrl}/auth/login?error=oauth_failed`);
  }
}
