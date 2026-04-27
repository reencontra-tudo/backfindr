export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Rota de debug — bloqueada em produção
  if (process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/debug`;

  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    appUrl,
    redirectUri,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    incomingError: error,
    hasCode: !!code,
    codeLength: code?.length,
  };

  if (code) {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tokenData = await tokenResponse.json();
      info.tokenResponse = tokenData;
      info.tokenStatus = tokenResponse.status;
    } catch (err) {
      info.tokenError = String(err);
    }
  }

  return NextResponse.json(info, {
    headers: { 'Content-Type': 'application/json' },
  });
}
