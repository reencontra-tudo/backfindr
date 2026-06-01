export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com';
  const secretKey = process.env.SECRET_KEY!;

  if (!clientId) {
    return NextResponse.json({ detail: 'Google OAuth não configurado' }, { status: 500 });
  }

  const redirectUri = `${appUrl}/api/analytics/callback`;

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', [
    'openid',
    'email',
    'https://www.googleapis.com/auth/analytics.readonly',
  ].join(' '));
  // Criar um state token assinado com o user_id (válido por 10 minutos)
  // Isso permite que o callback identifique o usuário sem depender de cookies
  const stateToken = jwt.sign(
    { sub: auth.user.id, purpose: 'analytics_connect' },
    secretKey,
    { algorithm: 'HS256', expiresIn: '10m' }
  );

  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  googleAuthUrl.searchParams.set('state', stateToken);

  return NextResponse.redirect(googleAuthUrl.toString());
}
