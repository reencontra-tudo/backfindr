// URL base única (APP_URL): links de e-mail, pagamento, login e canonical saem com https://backfindr.com.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const sent: any[] = [];
const prefs: any[] = [];
vi.mock('@/lib/emailSend', () => ({
  deliverEmail: vi.fn(async (o: any) => { sent.push(o); return { sent: true }; }),
  unsubscribeUrl: (t: string) => `UNSUB/${t}`,
}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    if (/FROM users WHERE id/.test(sql)) return { rows: [{ id: 'u1', email: 'a@b.c', name: 'Teste', plan: 'free' }] };
    if (/FROM objects WHERE id/.test(sql)) return { rows: [{ id: 'o1', title: 'Obj' }] };
    if (/payment_settings/.test(sql)) return { rows: [{ value: 'true' }] };
    return { rows: [], rowCount: 0 };
  }),
}));
vi.mock('@/lib/jwt', () => ({ verifyToken: () => ({ sub: 'u1' }), extractTokenFromHeader: () => 'tok' }));
vi.mock('@/lib/sendThrottle', () => ({ consumeEmailRequestSlots: async () => true }));
vi.mock('@/lib/adminGuard', () => ({ requireSuperAdmin: async () => ({ user: { id: 'adm' } }) }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Preference: class { async create(o: any) { prefs.push(o.body); return { id: 'p1', init_point: 'IP', sandbox_init_point: 'SIP' }; } },
}));

const PROD = 'https://backfindr.com';
const urlsOf = (html: string) => (html.match(/https?:\/\/[^"'\s<)]+/g) ?? []).filter(u => u.includes('backfindr'));

async function withEnv(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = value;
  process.env.MP_ACCESS_TOKEN = 'TEST-local';
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.SECRET_KEY = 'chave-local-de-teste-nao-real';
}
async function req(p: string, body?: unknown) {
  const { NextRequest } = await import('next/server');
  return new NextRequest('http://x.test' + p, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
    headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
  });
}

const original = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { sent.length = 0; prefs.length = 0; });
afterEach(() => { if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = original; });

describe('APP_URL', () => {
  it.each([
    [undefined, PROD],
    ['', PROD],
    ['   ', PROD],
    [PROD, PROD],
    [`${PROD}/`, PROD],
    [`${PROD}///`, PROD],
    ['http://localhost:3003', 'http://localhost:3003'],
  ])('NEXT_PUBLIC_APP_URL=%j → %s', async (env, esperado) => {
    await withEnv(env);
    const { APP_URL } = await import('@/lib/constants');
    expect(APP_URL).toBe(esperado);
  });
});

describe('links de e-mail', () => {
  it.each([
    ['boas-vindas', (m: any) => m.sendWelcomeEmail({ name: 'Ana', email: 'a@b.c' })],
    ['match', (m: any) => m.sendMatchAlertEmail({ name: 'Ana', email: 'a@b.c' }, 'Chave', 'm1', 87, 'Chave achada')],
    ['reativação', (m: any) => m.sendReactivationEmail({ name: 'Ana', email: 'a@b.c' }, 'Chave', ['dica'])],
    ['objeto encontrado', (m: any) => m.sendObjectFoundEmail({ name: 'Ana', email: 'a@b.c' }, { id: 'o1', title: 'Chave', category: 'keys' })],
    ['guia pet', (m: any) => m.sendGuideLostPetEmail({ name: 'Ana', email: 'a@b.c' })],
  ])('%s: todos os links usam o domínio sem www', async (_n, fn) => {
    await withEnv(PROD);
    await fn(await import('@/lib/email'));
    expect(sent).toHaveLength(1);
    const urls = urlsOf(sent[0].html);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u.startsWith(PROD)).toBe(true);
    expect(sent[0].html).not.toContain('www.backfindr.com');
  });

  it('sem a variável, os e-mails também saem com o domínio canônico', async () => {
    await withEnv(undefined);
    const m = await import('@/lib/email');
    await m.sendWelcomeEmail({ name: 'Ana', email: 'a@b.c' });
    expect(urlsOf(sent[0].html).every(u => u.startsWith(PROD))).toBe(true);
  });

  it('magic-link: o link de login aponta para o domínio canônico e não coloca o token em outro lugar', async () => {
    await withEnv(PROD);
    const m = await import('@/app/api/auth/magic-link/route');
    await m.POST(await req('/m', { email: 'a@b.c' }));
    expect(sent).toHaveLength(1);
    const links = urlsOf(sent[0].html);
    expect(links.some(u => u.startsWith(`${PROD}/api/auth/magic-link/verify?token=`))).toBe(true);
    expect(links.every(u => u.startsWith(PROD))).toBe(true);
  });

  it('magic-link/verify (GET) redireciona para a página de confirmação no domínio canônico', async () => {
    await withEnv(`${PROD}/`);
    const v = await import('@/app/api/auth/magic-link/verify/route');
    expect((await v.GET(await req('/v?token=t1'))).headers.get('location')).toBe(`${PROD}/auth/magic-confirm?token=t1`);
    expect((await v.GET(await req('/v'))).headers.get('location')).toBe(`${PROD}/auth/login?error=magic_link_invalid`);
  });
});

describe('pagamento', () => {
  it('billing (upgrade): success, failure, pending e notification_url', async () => {
    await withEnv(PROD);
    const b = await import('@/app/api/v1/billing/route');
    await b.POST(await req('/b', { action: 'upgrade', plan_slug: 'pro' }));
    expect(prefs[0].back_urls).toEqual({
      success: `${PROD}/checkout/success?type=plan&ref=pro`,
      failure: `${PROD}/checkout/failure`,
      pending: `${PROD}/checkout/pending`,
    });
    expect(prefs[0].notification_url).toBe(`${PROD}/api/v1/webhooks/mercadopago`);
  });

  it('boost: success, failure, pending e notification_url, também com barra final na variável', async () => {
    await withEnv(`${PROD}/`);
    const b = await import('@/app/api/v1/boost/route');
    await b.POST(await req('/b', { object_id: 'o1', type: '7d' }));
    expect(prefs[0].back_urls.success).toBe(`${PROD}/checkout/success?type=boost&ref=boost_7&object_id=o1`);
    expect(prefs[0].back_urls.failure).toBe(`${PROD}/checkout/failure`);
    expect(prefs[0].back_urls.pending).toBe(`${PROD}/checkout/pending`);
    expect(prefs[0].notification_url).toBe(`${PROD}/api/v1/webhooks/mercadopago`);
  });

  it('analytics: redirect_uri e redirecionamentos de volta usam o domínio canônico', async () => {
    await withEnv(PROD);
    const c = await import('@/app/api/analytics/connect/route');
    const loc = decodeURIComponent((await c.GET(await req('/c'))).headers.get('location') ?? '');
    expect(loc).toContain(`redirect_uri=${PROD}/api/analytics/callback`);
    const cb = await import('@/app/api/analytics/callback/route');
    expect((await cb.GET(await req('/c?error=x'))).headers.get('location')).toBe(`${PROD}/admin/sistema?analytics_error=oauth_denied`);
  });
});

describe('canonical e og:url das páginas públicas', () => {
  const root = path.resolve(__dirname, '..', 'src');
  const paginas = ['achei', 'buscar', 'encontrei', 'faq', 'map', 'perdi', 'pet', 'pricing', 'proteger', 'roubado', 'terms'];
  const arquivos = [
    ...paginas.map(p => [p, `app/${p}/page.tsx`] as const),
    ['auth/login', 'app/auth/login/layout.tsx'] as const,
    ['auth/register', 'app/auth/register/layout.tsx'] as const,
  ];

  it.each(arquivos)('/%s: canonical e og:url vêm de APP_URL', (rota, arquivo) => {
    const src = fs.readFileSync(path.join(root, arquivo), 'utf8');
    expect(src).toContain("import { APP_URL } from '@/lib/constants';");
    expect(src).toContain(`canonical: \`\${APP_URL}/${rota}\``);
    expect(src).toContain(`url: \`\${APP_URL}/${rota}\``);
  });

  it('nenhum arquivo tocado volta a ter domínio fixo errado (www, .com.br ou vercel.app)', () => {
    const tocados = [
      ...arquivos.map(a => a[1]),
      'app/api/analytics/connect/route.ts', 'app/api/analytics/callback/route.ts',
      'app/api/auth/magic-link/route.ts', 'app/api/auth/magic-link/verify/route.ts',
      'app/api/v1/billing/route.ts', 'app/api/v1/boost/route.ts',
      'app/objeto/[code]/page.tsx', 'app/objeto/[code]/client.tsx',
      'app/dashboard/objects/[id]/page.tsx', 'app/dashboard/objects/[id]/sucesso/page.tsx',
      'app/flow/lost/client.tsx', 'app/flow/pet/client.tsx',
      'components/RecoveredCelebration.tsx', 'lib/email.ts',
    ];
    for (const f of tocados) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      expect(src, f).not.toMatch(/www\.backfindr\.com|backfindr\.com\.br\/|backfindr\.vercel\.app/);
    }
  });
});

describe('domínios antigos fora do código', () => {
  const root = path.resolve(__dirname, '..', 'src');
  it.each(['app/dashboard/objects/page.tsx', 'app/scan/[code]/client.tsx'])('%s usa APP_URL em vez de backfindr.app', f => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    expect(src).toContain("import { APP_URL } from '@/lib/constants';");
    expect(src).not.toMatch(/backfindr\.(app|online|io)/);
  });
  it('link de compartilhar do cartão e fallback do scan seguem o formato esperado', () => {
    expect(fs.readFileSync(path.join(root, 'app/dashboard/objects/page.tsx'), 'utf8')).toContain('`${APP_URL}/objeto/${obj.unique_code}`');
    expect(fs.readFileSync(path.join(root, 'app/scan/[code]/client.tsx'), 'utf8')).toContain('`${APP_URL}/scan/${code}`');
  });
});
