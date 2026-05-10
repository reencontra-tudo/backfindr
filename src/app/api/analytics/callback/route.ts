export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.com';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=oauth_denied`);
  }

  // Verificar que o usuário está autenticado como super_admin via cookie
  const cookieToken = req.cookies.get('access_token')?.value;
  if (!cookieToken) {
    return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=not_authenticated`);
  }
  const payload = verifyToken(cookieToken);
  if (!payload) {
    return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=invalid_token`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/analytics/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=not_configured`);
    }

    // Trocar código por tokens
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
      console.error('[analytics/callback] token error:', tokenData);
      return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=token_failed`);
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Salvar ou atualizar token no banco
    await query(`
      INSERT INTO analytics_tokens (user_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, analytics_tokens.refresh_token),
        token_type = EXCLUDED.token_type,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = NOW()
    `, [
      payload.sub,
      tokenData.access_token,
      tokenData.refresh_token ?? null,
      tokenData.token_type ?? 'Bearer',
      expiresAt,
      tokenData.scope ?? null,
    ]);

    return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_connected=1`);
  } catch (err) {
    console.error('[analytics/callback] error:', err);
    return NextResponse.redirect(`${appUrl}/admin/sistema?analytics_error=server_error`);
  }
}
