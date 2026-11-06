// Garante que os callbacks OAuth (Google e Facebook) entregam os tokens por Set-Cookie e nunca na URL,
// e que links antigos com tokens na query são limpos no servidor. Sem banco: db, e-mail e fetch são
// simulados; os JWT são reais (SECRET_KEY de teste).
//
//   npx vitest@2 run --config tests/vitest.config.ts tests/oauth-token-fora-da-url.test.ts
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

process.env.SECRET_KEY = 'chave-de-teste-nao-usada-em-producao';
process.env.NEXT_PUBLIC_APP_URL = 'https://app.teste.local';
process.env.GOOGLE_CLIENT_ID = 'id-teste';
process.env.GOOGLE_CLIENT_SECRET = 'segredo-teste';
process.env.FACEBOOK_APP_ID = 'id-teste';
process.env.FACEBOOK_APP_SECRET = 'segredo-teste';

vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) =>
    sql.startsWith('SELECT')
      ? { rows: [{ id: 'user-1', email: 'pessoa@teste.local', name: 'Pessoa' }] }
      : { rows: [] },
  ),
}));
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/awaitSends', () => ({ awaitSends: vi.fn(async () => undefined) }));

const jsonResponse = (body: unknown) => ({ json: async () => body }) as unknown as Response;

function mockProviderFetch(userData: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      jsonResponse(String(url).includes('token') && !String(url).includes('/me?') && !String(url).includes('userinfo')
        ? { access_token: 'token-do-provedor' }
        : userData),
    ),
  );
}

// Lê o corpo de um Set-Cookie sem expor valor: devolve atributos e se o valor tem formato de JWT.
function parseSetCookies(res: Response) {
  const raw = res.headers.getSetCookie();
  return Object.fromEntries(
    raw.map((c) => {
      const [pair, ...attrs] = c.split(';').map((s) => s.trim());
      const eq = pair.indexOf('=');
      return [
        pair.slice(0, eq),
        { looksLikeJwt: /^[\w-]+\.[\w-]+\.[\w-]+$/.test(pair.slice(eq + 1)), attrs: attrs.map((a) => a.toLowerCase()) },
      ];
    }),
  );
}

function expectNoTokensInLocation(res: Response) {
  const location = res.headers.get('location') ?? '';
  const url = new URL(location);
  expect(url.search).not.toMatch(/access_token|refresh_token/);
  expect(url.hash).toBe('');
  expect(location).not.toMatch(/eyJ[\w-]+\.[\w-]+\./); // nenhum JWT em lugar nenhum da URL
}

afterEach(() => vi.unstubAllGlobals());

describe('callbacks OAuth: tokens em Set-Cookie, nunca na URL', () => {
  beforeAll(() => {
    // produção, para conferir o atributo Secure
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('Google: Set-Cookie com os dois tokens e Location sem token', async () => {
    mockProviderFetch({ id: 'g-1', email: 'pessoa@teste.local', name: 'Pessoa', picture: null });
    const { GET } = await import('@/app/api/auth/callback/route');
    const res = (await GET(new NextRequest('https://app.teste.local/api/auth/callback?code=abc'))) as Response;

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/google-success');
    expectNoTokensInLocation(res);

    const cookies = parseSetCookies(res);
    for (const name of ['access_token', 'refresh_token']) {
      expect(cookies[name].looksLikeJwt).toBe(true);
      expect(cookies[name].attrs).toEqual(
        expect.arrayContaining(['path=/', 'max-age=2592000', 'samesite=lax', 'secure']),
      );
      expect(cookies[name].attrs).not.toContain('httponly'); // o cliente ainda lê estes cookies
    }
  });

  it('Facebook: Set-Cookie com os dois tokens e Location sem token', async () => {
    mockProviderFetch({ id: 'f-1', name: 'Pessoa', email: 'pessoa@teste.local' });
    const { GET } = await import('@/app/api/auth/callback/facebook/route');
    const res = (await GET(new NextRequest('https://app.teste.local/api/auth/callback/facebook?code=abc'))) as Response;

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/auth/google-success');
    expectNoTokensInLocation(res);

    const cookies = parseSetCookies(res);
    for (const name of ['access_token', 'refresh_token']) {
      expect(cookies[name].looksLikeJwt).toBe(true);
      expect(cookies[name].attrs).toEqual(
        expect.arrayContaining(['path=/', 'max-age=2592000', 'samesite=lax', 'secure']),
      );
      expect(cookies[name].attrs).not.toContain('httponly');
    }
  });

  it('Google: falha do provedor não grava cookie algum', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'invalid_grant' })));
    const { GET } = await import('@/app/api/auth/callback/route');
    const res = (await GET(new NextRequest('https://app.teste.local/api/auth/callback?code=abc'))) as Response;
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe('middleware: link antigo com token na query', () => {
  it.each(['/auth/google-success', '/auth/magic-success'])(
    '%s: redireciona no servidor para a mesma página sem os tokens, preservando o resto',
    async (pathname) => {
      const { middleware } = await import('@/middleware');
      const res = middleware(
        new NextRequest(`https://app.teste.local${pathname}?access_token=valor-a&refresh_token=valor-b&new=1`),
      );
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get('location')!);
      expect(location.pathname).toBe(pathname);
      expect(location.search).toBe('?new=1');
      expect(res.headers.get('location')).not.toMatch(/valor-a|valor-b|access_token|refresh_token/);
      expect(res.headers.getSetCookie()).toEqual([]); // os valores são ignorados, não viram cookie
    },
  );

  it('sem token na query, segue normalmente', async () => {
    const { middleware } = await import('@/middleware');
    const res = middleware(new NextRequest('https://app.teste.local/auth/google-success?new=1'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('não interfere em outras rotas', async () => {
    const { middleware } = await import('@/middleware');
    const res = middleware(new NextRequest('https://app.teste.local/?access_token=x'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('google-success não lê token da URL', () => {
  it('o código da página não consulta access_token/refresh_token na query', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/app/auth/google-success/page.tsx'), 'utf8');
    expect(src).not.toMatch(/searchParams\.get\(['"](access_token|refresh_token)['"]\)/);
    expect(src).not.toMatch(/setTokens/);
  });
});
