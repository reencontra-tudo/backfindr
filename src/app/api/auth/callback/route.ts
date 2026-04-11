import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth_denied', request.url));
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: `${request.nextUrl.origin}/api/auth/callback` }),
    });

    if (!response.ok) throw new Error('OAuth failed');

    const { access_token, refresh_token } = await response.json();

    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));

    redirectResponse.cookies.set('access_token', access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    redirectResponse.cookies.set('refresh_token', refresh_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return redirectResponse;
  } catch {
    return NextResponse.redirect(new URL('/auth/login?error=oauth_failed', request.url));
  }
}
