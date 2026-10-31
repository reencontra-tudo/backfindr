import type { NextResponse } from 'next/server';

// Mesmos nomes e atributos que setTokens (src/lib/api.ts) grava no navegador: 30 dias, path /,
// SameSite=Lax, Secure em produção e SEM HttpOnly, porque o cliente ainda lê esses cookies
// (interceptor do axios). Usado pelos callbacks OAuth para que os tokens nunca passem pela URL.
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function setAuthCookies(response: NextResponse, tokens: { accessToken: string; refreshToken: string }): void {
  const attrs = {
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  };
  response.cookies.set('access_token', tokens.accessToken, attrs);
  response.cookies.set('refresh_token', tokens.refreshToken, attrs);
}
