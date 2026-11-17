// Erros internos nunca chegam ao navegador com o texto da exceção ou do banco; o detalhe vai só para o log.
// Erros de validação e de «não encontrado» continuam exatamente como eram (ver GOLDEN).
// A parte de banco usa um Postgres REAL e é pulada sem TEST_DATABASE_URL. ATENÇÃO: recria users, password_reset_tokens,
// estabelecimentos, entregadores, entregas, entrega_eventos, custodias, custody_eventos e condominios (banco descartável).
//
//   TEST_DATABASE_URL=postgres://u:pw@127.0.0.1:5432/bftest npx vitest run --config tests/vitest.config.ts tests/erro-interno.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import {
  CODIGO_ERRO_INTERNO,
  MENSAGEM_ERRO_INTERNO,
  corpoErroInterno,
  redigirParaLog,
  registrarErroInterno,
  resumoDoErroParaLog,
  respostaErroInterno,
} from '@/lib/erroInterno';
import { internalErrorResponse } from '@/lib/response';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// O token de teste é o próprio user_id.
vi.mock('@/lib/jwt', async (orig) => {
  const m = await orig<typeof import('@/lib/jwt')>();
  return { ...m, extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => ({ sub: t }) };
});

const ROOT = path.resolve(__dirname, '..');
const lê = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

// ── 1) Redação e helper ──────────────────────────────────────────────────────────────────────────────────
describe('redigirParaLog — segredos e dados pessoais não vão para o log', () => {
  const R = '[redigido]';
  it.each([
    ['Authorization: Bearer abc.DEF-123_xyz=', 'abc.DEF'],
    ['falha com eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', 'eyJhbGci'],
    ['connect ECONNREFUSED postgres://usuario:SenhaDoBanco@db.exemplo.test:5432/app', 'SenhaDoBanco'],
    ['Key (email)=(pessoa.secreta@exemplo.test) already exists.', 'pessoa.secreta'],
    ['falhou para pessoa.secreta@exemplo.test ao gravar', 'pessoa.secreta'],
    ['telefone (11) 99999-0000 inválido', '99999-0000'],
    ['telefone +55 11 99999-0000 inválido', '99999-0000'],
    ['telefone 11999990000 inválido', '11999990000'],
    ['link /delivery/dlv_ABCDEFGHJKMNPQRSTUVWXYZabcdefgh23456 não achado', 'ABCDEFGHJKMNPQRSTUVWXYZ'],
    ['{"access_token":"ya29.a0AfH6SMBxxxxxxxxxxxxx","refresh_token":"1//0gxxxxxxxxxxxx"}', 'ya29'],
    ['password=SenhaSecreta123&x=1', 'SenhaSecreta123'],
    ['api_key: sk_live_123456', 'sk_live_123456'],
    ['cookie=access_token=abc123def', 'abc123def'],
  ])('%s', (entrada, proibido) => {
    const saida = redigirParaLog(entrada);
    expect(saida).not.toContain(proibido);
    expect(saida).toContain(R);
  });
  it('mantém o que ajuda a depurar (nome de tabela e de coluna, código, tipo de falha)', () => {
    const s = redigirParaLog('relation "entregas" does not exist; column e.link_token does not exist; ECONNREFUSED 127.0.0.1:5432');
    expect(s).toContain('relation "entregas" does not exist');
    expect(s).toContain('column e.link_token does not exist');
    expect(s).toContain('ECONNREFUSED');
  });
});

describe('resumoDoErroParaLog / registrarErroInterno', () => {
  const pgErro = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
    code: '23505', severity: 'ERROR', table: 'users', column: 'email', constraint: 'users_email_key', routine: '_bt_check_unique',
    detail: 'Key (email)=(pessoa.secreta@exemplo.test) already exists.', where: 'SQL: SELECT * FROM users WHERE email = $1',
    query: 'SELECT senha FROM users', parameters: ['pessoa.secreta@exemplo.test', 'SenhaSecreta123'],
  });
  it('traz o que ajuda (código, tabela, coluna, restrição) e nada de valores, consulta ou parâmetros', () => {
    const r = resumoDoErroParaLog(pgErro);
    expect(r).toMatchObject({ nome: 'Error', code: '23505', table: 'users', column: 'email', constraint: 'users_email_key' });
    const texto = JSON.stringify(r);
    for (const proibido of ['pessoa.secreta', 'SenhaSecreta123', 'SELECT senha', 'parameters', 'where']) expect(texto, proibido).not.toContain(proibido);
  });
  it('aceita erro que não é Error (texto, objeto, circular, null)', () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    for (const v of ['texto com token=abc123', { a: 1 }, circ, null, undefined, 42]) expect(() => resumoDoErroParaLog(v)).not.toThrow();
    expect(JSON.stringify(resumoDoErroParaLog('texto com token=abc123def456'))).not.toContain('abc123def456');
  });
  it('registrarErroInterno escreve no console.error com o nome da rota, sem o objeto bruto', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    registrarErroInterno('custody/link', pgErro);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('[custody/link]');
    expect(spy.mock.calls[0][1]).not.toBe(pgErro);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('pessoa.secreta');
    spy.mockRestore();
  });
});

describe('respostaErroInterno / internalErrorResponse', () => {
  const erroDoBanco = Object.assign(new Error('column "link_token" of relation "entregas" does not exist'), { code: '42703', table: 'entregas' });
  afterEach(() => vi.restoreAllMocks());
  it('devolve mensagem simples e código estável, com o status 500 de sempre, sem nada do erro', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = respostaErroInterno('x', erroDoBanco);
    expect(r.status).toBe(500);
    const corpo = await r.json();
    expect(corpo).toEqual({ detail: MENSAGEM_ERRO_INTERNO, code: CODIGO_ERRO_INTERNO });
    expect(JSON.stringify(corpo)).not.toMatch(/column|relation|entregas|link_token|42703/);
  });
  it('mantém o campo que a tela lê (error, message) e aceita mensagem própria e outro status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await respostaErroInterno('x', erroDoBanco, { campo: 'error' }).json()).toEqual({ error: MENSAGEM_ERRO_INTERNO, code: 'erro_interno' });
    const r = respostaErroInterno('x', erroDoBanco, { campo: 'message', mensagem: 'Tente de novo.', status: 503 });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ message: 'Tente de novo.', code: 'erro_interno' });
    expect(corpoErroInterno()).toEqual({ detail: MENSAGEM_ERRO_INTERNO, code: CODIGO_ERRO_INTERNO });
  });
  it('internalErrorResponse (usado por 36 rotas) deixou de devolver error.message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const erro of [erroDoBanco, new Error('connect ECONNREFUSED 127.0.0.1:5432'), 'texto', undefined, { message: 'x' }]) {
      const r = internalErrorResponse(erro);
      expect(r.status).toBe(500);
      expect(await r.json()).toEqual({ detail: MENSAGEM_ERRO_INTERNO, code: CODIGO_ERRO_INTERNO });
    }
    expect(spy).toHaveBeenCalledTimes(5); // o detalhe foi para o log
  });
});

// ── 2) Guardas no código ─────────────────────────────────────────────────────────────────────────────────
// Rotas que AINDA devolvem texto bruto, de propósito: admin, migração, cron e diagnóstico (quem chama é um
// operador autenticado ou um agendador com segredo). Uma rota nova com o padrão antigo fora desta lista falha.
const PERMITIDAS_COM_TEXTO_BRUTO = new Set([
  'v1/admin/analytics/ga4/route.ts',
  'v1/admin/analytics/route.ts',
  'v1/admin/analytics/snapshot/route.ts',
  'v1/admin/b2b/[id]/objects/route.ts',
  'v1/admin/b2b/[id]/stats/route.ts',
  'v1/admin/classify-legacy-persons/route.ts',
  'v1/admin/comunidade/generate/route.ts',
  'v1/admin/fix-legacy-categories/route.ts',
  'v1/admin/fix-legacy-public-signal-descriptions/route.ts',
  'v1/admin/fix-legacy-status/route.ts',
  'v1/admin/migrate-search/route.ts',
  'v1/admin/migrate/route.ts',
  'v1/admin/push/migrate/route.ts',
  'v1/admin/r2/health/route.ts',
  'v1/admin/r2/migrate/route.ts',
  'v1/admin/social/posts/route.ts',
  'v1/admin/social/settings/route.ts',
  'v1/admin/team/route.ts',
  'v1/assistant/chat/route.ts',
  'v1/cron/found-pending-reminders/route.ts',
  'v1/cron/lifecycle/route.ts',
  'v1/cron/matching/route.ts',
  'v1/cron/reactivation/route.ts',
  'v1/delivery/estabelecimentos/route.ts',
  'v1/local-pages/generate/route.ts',
  'v1/local-pages/publish/route.ts',
  'v1/portaria/condominios/route.ts',
]);

function rotas(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) rotas(rel, acc);
    else if (/^route\.tsx?$/.test(n)) acc.push(rel);
  }
  return acc;
}
function temTextoBruto(src: string): boolean {
  const vars = [...src.matchAll(/catch\s*\(\s*(\w+)/g)].map((m) => m[1]);
  for (const linha of src.split('\n')) {
    const t = linha.trim();
    if (t.startsWith('//') || t.includes('console.') || /\bcatch\b/.test(t)) continue;
    if (!/Response|json\(|errorResponse|detail|error\s*:|message\s*:|details\s*:/.test(t)) continue;
    for (const v of vars) {
      if (new RegExp(`(String\\(\\s*${v}\\s*\\)|(?<![\\w.])${v}\\??\\.message|\\$\\{\\s*${v}\\s*\\}|JSON\\.stringify\\(\\s*${v}\\s*\\))`).test(t)) return true;
    }
  }
  return false;
}

describe('guardas: nenhuma rota pública ou de usuário logado devolve o texto do erro', () => {
  const todas = rotas('src/app/api');
  it('as 27 exceções declaradas são mesmo as únicas com texto bruto (uma rota nova com o padrão antigo falha aqui)', () => {
    const achadas = todas.filter((f) => temTextoBruto(lê(f))).map((f) => f.replace('src/app/api/', '')).sort();
    expect(achadas).toEqual([...PERMITIDAS_COM_TEXTO_BRUTO].sort());
  });
  it('a lista de exceções só tem rotas que existem e que ainda têm o padrão (não acumula lixo)', () => {
    const existentes = new Set(todas.map((f) => f.replace('src/app/api/', '')));
    for (const p of PERMITIDAS_COM_TEXTO_BRUTO) expect(existentes.has(p), p).toBe(true);
  });
  it('o helper central não devolve error.message', () => {
    const r = lê('src/lib/response.ts');
    expect(r).not.toMatch(/error\??\.message/);
    expect(r).toContain('respostaErroInterno');
  });
  it('o login Google não leva mais o corpo de erro do Google nem o endereço de retorno na URL', () => {
    const c = lê('src/app/api/auth/callback/route.ts');
    expect(c).not.toMatch(/detail=|used_uri|errorDetail|usedRedirectUri/);
    expect(c).toContain('/auth/login?error=google_token_failed');
    expect(lê('src/app/auth/login/page.tsx')).not.toMatch(/used_uri|searchParams\.get\(['"]detail/); // a tela nunca usou esses parâmetros
  });
  it('o cartaz devolve mensagem simples em vez de «Erro: <texto>»', () => {
    const p = lê('src/app/api/v1/objects/[id]/poster/route.tsx');
    expect(p).not.toMatch(/Erro: \$\{/);
    expect(p).toContain('Não foi possível gerar o cartaz agora');
  });
  it('as rotas de validação não foram tocadas: mensagens de erro de usuário continuam no código', () => {
    expect(lê('src/app/api/v1/auth/login/route.ts')).toContain("errorResponse('Username and password are required', 400)");
    expect(lê('src/app/api/v1/auth/register/route.ts')).toContain("errorResponse('Password must be at least 8 characters', 400)");
    expect(lê('src/app/api/v1/auth/reset-password/route.ts')).toContain("errorResponse('Invalid or expired reset token', 400)");
    expect(lê('src/app/api/v1/custody/link/[token]/route.ts')).toContain("{ detail: 'Link inválido ou expirado' }, { status: 404 }");
  });
});

// ── 3) Banco real ────────────────────────────────────────────────────────────────────────────────────────
const FORBIDDEN = /relation|column|does not exist|ECONNREFUSED|ECONNRESET|127\.0\.0\.1|localhost|postgres|pg_|SELECT |FROM |INSERT |UPDATE |syntax error|\bat\s+\S+\.(ts|tsx|js)|node_modules|\/home\/|webpack|\.next|stack|entregas|custodias|users|link_token|SqlState|42P01|42703/i;
const SEGREDOS = ['pessoa.secreta@exemplo.test', 'SenhaSecreta123', 'cst_TOKENSECRETOabcdefghijklmnopqrstuvwxyz', 'dlv_TOKENSECRETOabcdefghijklmnopqrstuvwxyz'];

describe.skipIf(!TEST_DB)('rotas públicas com o banco falhando', () => {
  let pool: Pool;
  type Ctx = { params: Record<string, string> };
  type Rota = { nome: string; rota: string; chamar: () => Promise<Response> };
  const get = (url = 'http://localhost/x') => new NextRequest(url);
  const post = (corpo: unknown, url = 'http://localhost/x') => new NextRequest(url, { method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } });
  const autenticado = (url = 'http://localhost/x') => new NextRequest(url, { headers: { authorization: 'Bearer 40000000-0000-0000-0000-000000000001' } });
  let m: Record<string, (r: NextRequest, c: Ctx) => Promise<Response>>;
  const U = '40000000-0000-0000-0000-000000000001';

  const rotasPublicas = (): Rota[] => [
    { nome: 'custody/link', rota: 'custody/link', chamar: () => m.custodyLink(get(), { params: { token: SEGREDOS[2] } }) },
    { nome: 'delivery/link', rota: 'delivery/link', chamar: () => m.deliveryLink(get(), { params: { token: SEGREDOS[3] } }) },
    { nome: 'custody/confirmar', rota: 'custody/confirmar', chamar: () => m.custodyConfirmar(post({}), { params: { token: SEGREDOS[2] } }) },
    { nome: 'delivery/confirmar', rota: 'delivery/confirmar', chamar: () => m.deliveryConfirmar(post({}), { params: { token: SEGREDOS[3] } }) },
    { nome: 'auth/login', rota: 'auth/login', chamar: () => m.login(post({ username: SEGREDOS[0], password: SEGREDOS[1] }), { params: {} }) },
    { nome: 'auth/register', rota: 'auth/register', chamar: () => m.register(post({ name: 'Pessoa Secreta', email: SEGREDOS[0], password: SEGREDOS[1] }), { params: {} }) },
    { nome: 'auth/reset-password', rota: 'auth/reset-password', chamar: () => m.reset(post({ token: SEGREDOS[2], new_password: SEGREDOS[1] }), { params: {} }) },
    { nome: 'objects/scan', rota: 'objects/scan', chamar: () => m.scan(get(), { params: { code: 'ABC12345' } }) },
    { nome: 'users/public', rota: 'users/public', chamar: () => m.userPublic(get(), { params: { id: U } }) },
    { nome: 'portaria/condominios/slug', rota: 'portaria/condominios/slug', chamar: () => m.condominioSlug(get(), { params: { slug: 'x' } }) },
    { nome: 'delivery/minhas-entregas (logado)', rota: 'delivery/minhas-entregas', chamar: () => m.minhasEntregas(autenticado(), { params: {} }) },
    { nome: 'custody/items (logado)', rota: 'custody/items', chamar: () => m.custodyItems(autenticado(), { params: {} }) },
  ];

  function valores(o: unknown): string[] {
    if (o && typeof o === 'object') return Object.values(o as Record<string, unknown>).flatMap(valores);
    return [String(o)];
  }

  async function verifica(r: Rota, esperaNoLog: RegExp, logs: () => string) {
    const res = await r.chamar();
    expect(res.status, r.nome).toBe(500); // mesmo status de antes
    const texto = await res.text();
    const corpo = JSON.parse(texto);
    expect(corpo.code, r.nome).toBe(CODIGO_ERRO_INTERNO);
    for (const v of valores(corpo).filter((x) => x !== CODIGO_ERRO_INTERNO)) expect(v, r.nome).toBe(MENSAGEM_ERRO_INTERNO);
    expect(texto, r.nome).not.toMatch(FORBIDDEN);
    for (const s of SEGREDOS) expect(texto, r.nome).not.toContain(s);
    // o detalhe foi para o log do servidor, sem segredos
    expect(logs(), r.nome).toMatch(esperaNoLog);
    for (const s of SEGREDOS) expect(logs(), `log de ${r.nome}`).not.toContain(s);
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    m = {} as typeof m;
    m.custodyLink = (await import('@/app/api/v1/custody/link/[token]/route')).GET as never;
    m.deliveryLink = (await import('@/app/api/v1/delivery/link/[token]/route')).GET as never;
    m.custodyConfirmar = (await import('@/app/api/v1/custody/confirmar/[token]/route')).POST as never;
    m.deliveryConfirmar = (await import('@/app/api/v1/delivery/confirmar/[token]/route')).POST as never;
    m.login = (await import('@/app/api/v1/auth/login/route')).POST as never;
    m.register = (await import('@/app/api/v1/auth/register/route')).POST as never;
    m.reset = (await import('@/app/api/v1/auth/reset-password/route')).POST as never;
    m.scan = (await import('@/app/api/v1/objects/scan/[code]/route')).GET as never;
    m.userPublic = (await import('@/app/api/v1/users/[id]/public/route')).GET as never;
    m.condominioSlug = (await import('@/app/api/v1/portaria/condominios/[slug]/route')).GET as never;
    m.minhasEntregas = (await import('@/app/api/v1/delivery/minhas-entregas/route')).GET as never;
    m.custodyItems = (await import('@/app/api/v1/custody/items/route')).GET as never;
    m.poster = (await import('@/app/api/v1/objects/[id]/poster/route')).GET as never;
  });
  afterAll(async () => {
    await pool?.end();
    process.env.DATABASE_URL = TEST_DB;
    const { closePool } = await import('@/lib/db');
    await closePool();
  });
  afterEach(() => vi.restoreAllMocks());

  const logsDe = (spy: ReturnType<typeof vi.spyOn>) => JSON.stringify(spy.mock.calls);

  const textoDoCartaz = async (spy: ReturnType<typeof vi.spyOn>) => {
    const res = await m.poster(get('http://localhost/x?format=a4'), { params: { id: '40000000-0000-0000-0000-0000000000aa' } });
    const texto = await res.text();
    return { status: res.status, texto, log: logsDe(spy) };
  };

  describe('tabela ou coluna inexistente (esquema diferente do esperado)', () => {
    beforeAll(async () => {
      // users sem is_system_account e sem phone; as demais tabelas não existem
      await pool.query(`
        DROP TABLE IF EXISTS custody_eventos, entrega_eventos, custodias, entregas, entregadores, estabelecimentos, condominios, password_reset_tokens CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        CREATE TABLE users (id uuid PRIMARY KEY, email varchar(255) NOT NULL, name varchar(255) NOT NULL DEFAULT 'x', password varchar(255) DEFAULT '', plan varchar(50) DEFAULT 'free', role varchar(50), b2b_partner_id uuid);
        INSERT INTO users (id, email) VALUES ('${U}', 'logado@exemplo.test');
      `);
      const { closePool } = await import('@/lib/db');
      await closePool();
    });
    it.each(Array.from({ length: 12 }, (_, i) => i))('rota %i: 500 com mensagem simples, sem texto do banco; o log recebe o detalhe', async (i) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = rotasPublicas()[i];
      await verifica(r, /does not exist|42P01|42703/, () => logsDe(spy));
    });
  });

  describe('cartaz (resposta em texto, não JSON)', () => {
    it('banco fora do ar: 500 com frase simples, sem texto do erro; o log recebe o detalhe', async () => {
      process.env.DATABASE_URL = 'postgres://usuario:SenhaDoBanco@127.0.0.1:1/inexistente';
      const { closePool } = await import('@/lib/db');
      await closePool();
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const r = await textoDoCartaz(spy);
        expect(r.status).toBe(500);
        expect(r.texto).toBe('Não foi possível gerar o cartaz agora. Tente novamente em instantes.');
        expect(r.texto).not.toMatch(FORBIDDEN);
        expect(r.log).toMatch(/ECONNREFUSED/);
        expect(r.log).not.toContain('SenhaDoBanco');
      } finally {
        process.env.DATABASE_URL = TEST_DB;
        await closePool();
      }
    });
  });

  describe('banco fora do ar', () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = 'postgres://usuario:SenhaDoBanco@127.0.0.1:1/inexistente';
      const { closePool } = await import('@/lib/db');
      await closePool();
    });
    afterAll(async () => {
      process.env.DATABASE_URL = TEST_DB;
      const { closePool } = await import('@/lib/db');
      await closePool();
    });
    it.each(Array.from({ length: 12 }, (_, i) => i))('rota %i: 500 com mensagem simples, sem endereço do banco; o log recebe ECONNREFUSED sem a senha', async (i) => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = rotasPublicas()[i];
      if (r.nome.endsWith('(logado)')) return; // a autenticação já falha antes (resposta própria, sem texto do erro): coberta abaixo
      await verifica(r, /ECONNREFUSED/, () => logsDe(spy));
      expect(logsDe(spy)).not.toContain('SenhaDoBanco');
    });
    it('a autenticação com o banco fora também não devolve texto do erro', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const res = await m.minhasEntregas(autenticado(), { params: {} });
      const texto = await res.text();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(texto).not.toMatch(FORBIDDEN);
    });
  });

  // Validações, 401, 404 e 409 que as telas exibem: iguais às da `main` (mensagens capturadas lá).
  describe('GOLDEN: o que NÃO pode mudar', () => {
    beforeAll(async () => {
      await pool.query(`
        DROP TABLE IF EXISTS custody_eventos, entrega_eventos, custodias, entregas, entregadores, estabelecimentos, condominios, password_reset_tokens CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL UNIQUE, name varchar(255) NOT NULL DEFAULT 'x', phone varchar(50), password varchar(255) DEFAULT '', plan varchar(50) DEFAULT 'free', role varchar(50), b2b_partner_id uuid, is_system_account boolean NOT NULL DEFAULT false);
        CREATE TABLE password_reset_tokens (user_id uuid PRIMARY KEY, token_hash varchar(128) NOT NULL, expires_at timestamptz NOT NULL);
        CREATE TABLE condominios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(255) NOT NULL, endereco text NOT NULL);
        CREATE TABLE estabelecimentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(255) NOT NULL, telefone varchar(50), endereco text NOT NULL, lat numeric, lng numeric);
        CREATE TABLE entregadores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, estabelecimento_id uuid, veiculo varchar(50), status text, active boolean NOT NULL DEFAULT true);
        CREATE TABLE entregas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), estabelecimento_id uuid, entregador_id uuid, cliente_nome varchar(255), cliente_endereco text, qr_code varchar(20) NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text,1,8), link_token varchar(100) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text, status varchar(30) NOT NULL DEFAULT 'preparando', entregue_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE entrega_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrega_id uuid NOT NULL, tipo varchar(30) NOT NULL, lat numeric, lng numeric, user_id uuid, observacao text, created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE custodias (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), condominio_id uuid, remetente_id uuid, destinatario_nome varchar(255), descricao text, qr_code varchar(20) NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text,1,8), link_token varchar(100) NOT NULL UNIQUE DEFAULT gen_random_uuid()::text, status varchar(30) NOT NULL DEFAULT 'aguardando', custodiante_id uuid, custodiado_em timestamptz, entregue_em timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE custody_eventos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid NOT NULL, tipo varchar(30) NOT NULL, user_id uuid, lat numeric, lng numeric, observacao text, created_at timestamptz NOT NULL DEFAULT now());
        INSERT INTO users (email) VALUES ('ja.existe@exemplo.test');
      `);
      const { closePool } = await import('@/lib/db');
      await closePool();
    });
    const caso = async (fn: () => Promise<Response>) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const r = await fn();
      return [r.status, await r.json()] as const;
    };
    it('autenticação: validações, 401 e 409 com as mensagens de sempre', async () => {
      expect(await caso(() => m.login(post({}), { params: {} }))).toEqual([400, { detail: 'Username and password are required' }]);
      expect(await caso(() => m.login(post({ username: 'nao.existe@exemplo.test', password: 'qualquer123' }), { params: {} }))).toEqual([401, { detail: 'Invalid credentials' }]);
      expect(await caso(() => m.register(post({}), { params: {} }))).toEqual([400, { detail: 'Name, email and password are required' }]);
      expect(await caso(() => m.register(post({ name: 'A', email: 'a@exemplo.test', password: 'curta' }), { params: {} }))).toEqual([400, { detail: 'Password must be at least 8 characters' }]);
      expect(await caso(() => m.register(post({ name: 'A', email: 'JA.EXISTE@exemplo.test', password: 'umasenhalonga1' }), { params: {} }))).toEqual([409, { detail: 'User with this email already exists' }]);
      expect(await caso(() => m.reset(post({}), { params: {} }))).toEqual([400, { detail: 'Token and new password are required' }]);
      expect(await caso(() => m.reset(post({ token: 'x', new_password: 'curta' }), { params: {} }))).toEqual([400, { detail: 'Password must be at least 8 characters' }]);
      expect(await caso(() => m.reset(post({ token: 'naoexiste', new_password: 'umasenhalonga1' }), { params: {} }))).toEqual([400, { detail: 'Invalid or expired reset token' }]);
    });
    it('links de custódia e de entrega: token inexistente continua 404 genérico, nas leituras e nas confirmações', async () => {
      const esperado = [404, { detail: 'Link inválido ou expirado' }];
      expect(await caso(() => m.custodyLink(get(), { params: { token: 'cst_nao_existe' } }))).toEqual(esperado);
      expect(await caso(() => m.deliveryLink(get(), { params: { token: 'dlv_nao_existe' } }))).toEqual(esperado);
      expect(await caso(() => m.custodyConfirmar(post({}), { params: { token: 'cst_nao_existe' } }))).toEqual(esperado);
      expect(await caso(() => m.deliveryConfirmar(post({}), { params: { token: 'dlv_nao_existe' } }))).toEqual(esperado);
    });
    it('rota autenticada sem token continua 401 com a mensagem de sempre', async () => {
      const [status, corpo] = await caso(() => m.minhasEntregas(get(), { params: {} }));
      expect(status).toBe(401);
      expect(corpo).toEqual({ detail: 'Não autenticado' });
    });
    it('corpo que não é JSON continua sendo 500 (mesmo status), agora com mensagem simples', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const req = new NextRequest('http://localhost/x', { method: 'POST', body: 'isto não é json', headers: { 'content-type': 'application/json' } });
      const [status, corpo] = await caso(() => m.login(req, { params: {} }));
      expect(status).toBe(500);
      expect(corpo).toEqual({ detail: MENSAGEM_ERRO_INTERNO, code: CODIGO_ERRO_INTERNO });
    });
  });
});
