export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.com';

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
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  googleAuthUrl.searchParams.set('state', 'analytics_connect');

  return NextResponse.redirect(googleAuthUrl.toString());
}
