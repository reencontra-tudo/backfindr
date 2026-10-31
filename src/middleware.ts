import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'bf_acquisition';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 dias

// Páginas de sucesso de login que, em versões antigas, recebiam os tokens na query. Hoje os tokens
// vão em cookie; se um link antigo chegar com eles, a query é descartada (os valores são ignorados)
// por redirect no servidor, antes de qualquer renderização, para que PostHog, GA4, Clarity e
// gravação de sessão nunca vejam a URL com token.
const LEGACY_TOKEN_QUERY_PATHS = ['/auth/google-success', '/auth/magic-success'];
const TOKEN_QUERY_PARAMS = ['access_token', 'refresh_token'];

export function middleware(request: NextRequest) {
  if (
    LEGACY_TOKEN_QUERY_PATHS.includes(request.nextUrl.pathname) &&
    TOKEN_QUERY_PARAMS.some((p) => request.nextUrl.searchParams.has(p))
  ) {
    const clean = request.nextUrl.clone();
    TOKEN_QUERY_PARAMS.forEach((p) => clean.searchParams.delete(p));
    return NextResponse.redirect(clean);
  }

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
