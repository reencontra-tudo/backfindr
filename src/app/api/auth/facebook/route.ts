import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_APP_ID;

  if (!clientId) {
    return NextResponse.json({ error: 'Facebook OAuth not configured' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app';
  const redirectUri = `${appUrl}/api/auth/callback/facebook`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'email,public_profile',
    response_type: 'code',
    state: crypto.randomUUID(),
  });

  const facebookAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;

  return NextResponse.redirect(facebookAuthUrl);
}
