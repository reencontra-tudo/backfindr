import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'bf_acquisition';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 dias

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // First-touch attribution: só grava se ainda não existir o cookie
  const existing = request.cookies.get(COOKIE_NAME);
  if (existing) return response;

  const { searchParams, pathname } = request.nextUrl;
  const utm_source   = searchParams.get('utm_source');
  const utm_medium   = searchParams.get('utm_medium');
  const utm_campaign = searchParams.get('utm_campaign');
  const utm_content  = searchParams.get('utm_content');
  const utm_term     = searchParams.get('utm_term');
  const referrer     = request.headers.get('referer') || null;

  // Só grava cookie se houver pelo menos um sinal de origem
  const hasSignal = utm_source || utm_medium || utm_campaign || utm_content || utm_term || referrer;
  if (!hasSignal) return response;

  const data = {
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer,
    landing_page: pathname,
  };

  response.cookies.set(COOKIE_NAME, JSON.stringify(data), {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas exceto:
     * - api (rotas de API)
     * - _next/static, _next/image (assets do Next)
     * - favicon, ícones, arquivos estáticos
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
