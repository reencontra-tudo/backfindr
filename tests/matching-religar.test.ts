// Religar o matching com segurança: interruptor MATCHING_ATIVO (desligado por padrão), gancho corrigido,
// conta de sistema e legado sem aviso, eventos. Postgres REAL (pula sem TEST_DATABASE_URL); e-mail, push e rede SIMULADOS. Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const sent = vi.hoisted(() => ({ emails: [] as unknown[][], pushes: [] as unknown[][] }));
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));
vi.mock('@/lib/email', () => ({ sendMatchAlertEmail: vi.fn(async (...a: unknown[]) => { sent.emails.push(a); return {}; }) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async (...a: unknown[]) => { sent.pushes.push(a); return {}; }), matchPayload: () => ({}) }));
vi.mock('@/lib/adminGuard', () => ({ requireAdmin: vi.fn(async () => ({ user: { id: 'admin' } })) }));
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));

const SEGREDO_FALSO_DE_TESTE = 'segredo-falso-so-para-teste';

describe.skipIf(!TEST_DB)('matching: interruptor, gancho, travas e eventos (Postgres real)', () => {
  let pool: Pool;
  let POST: (r: NextRequest) => Promise<Response>;
  let CRON: (r: NextRequest) => Promise<Response>;
  let RUN: (r: NextRequest) => Promise<Response>;
  let RUNALL: (r: NextRequest) => Promise<Response>;
  let MATCHES: (r: NextRequest) => Promise<Response>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const matchingRunCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/v1/matching/run'));
  const cronReq = (auth = `Bearer ${SEGREDO_FALSO_DE_TESTE}`) => new NextRequest('http://localhost/api/v1/cron/matching', { headers: { authorization: auth } });
  const asUser = (method: string, uid: string, body?: unknown) =>
    new NextRequest('http://localhost/x', { method, headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const count = async (t: string, where = 'true') => Number((await pool.query(`SELECT COUNT(*) FROM ${t} WHERE ${where}`)).rows[0].count);

  const mkUser = async (over: { legacy?: boolean; system?: boolean; id?: string } = {}) => {
    const id = over.id ?? randomUUID();
    await pool.query(`INSERT INTO users (id, name, email, plan, is_legacy, is_system_account) VALUES ($1,'Pessoa Teste',$2,'business',$3,$4)`,
      [id, `${id.slice(0, 8)}@teste.invalid`, over.legacy ?? false, over.system ?? false]);
    return id;
  };
  const mkObj = async (userId: string, status: 'lost' | 'found', over: Record<string, unknown> = {}) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO objects (id, user_id, title, description, status, category, type, qr_code, latitude, longitude, color, is_legacy, source)
       VALUES ($1,$2,$3,$4,$5,'bag','bag',$6,-23.5,-46.6,'azul',$7,$8)`,
      [id, userId, over.title ?? 'Mochila azul grande', over.description ?? 'Mochila azul com zíper', status, randomUUID().slice(0, 8), over.legacy ?? false, over.source ?? null]);
    return id;
  };
  const cenario = async (donoOver: { legacy?: boolean; system?: boolean } = {}) => {
    const dono = await mkUser(donoOver);
    const achador = await mkUser();
    const perdido = await mkObj(dono, 'lost');
    const achado = await mkObj(achador, 'found');
    return { dono, achador, perdido, achado };
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS object_events, matches, objects, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, name text, email text, plan text, plan_expires_at timestamptz, is_legacy boolean DEFAULT false, is_system_account boolean NOT NULL DEFAULT false)`);
    await pool.query(`CREATE TABLE objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar NOT NULL, description text, status varchar DEFAULT 'lost', type varchar NOT NULL, location varchar,
      latitude numeric, longitude numeric, qr_code varchar NOT NULL UNIQUE, images jsonb DEFAULT '[]',
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), category varchar, is_public boolean DEFAULT true,
      reward_amount numeric, reward_description text, category_fields jsonb DEFAULT '{}', subject_name varchar, document_type varchar,
      color varchar, brand varchar, breed varchar, is_legacy boolean DEFAULT false, source varchar, resolved_at timestamp,
      found_pending_confirmation boolean DEFAULT false, found_pending_since timestamp)`);
    await pool.query(`CREATE TABLE matches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lost_object_id uuid REFERENCES objects(id) ON DELETE CASCADE,
      found_object_id uuid REFERENCES objects(id) ON DELETE CASCADE, score integer, status varchar, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), user_id uuid, notified_at timestamp)`);
    await pool.query(`CREATE TABLE object_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL, type text NOT NULL, title text NOT NULL, description text, source text NOT NULL DEFAULT 'system',
      actor_type text, actor_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now())`);
    process.env.CRON_SECRET = SEGREDO_FALSO_DE_TESTE;
    ({ POST } = await import('@/app/api/v1/objects/route'));
    ({ GET: CRON } = await import('@/app/api/v1/cron/matching/route'));
    ({ POST: RUN } = await import('@/app/api/v1/matching/run/route'));
    ({ POST: RUNALL } = await import('@/app/api/v1/admin/matching/run-all/route'));
    ({ GET: MATCHES } = await import('@/app/api/v1/matches/route'));
  });
  beforeEach(async () => {
    sent.emails.length = 0; sent.pushes.length = 0;
    delete process.env.MATCHING_ATIVO;
    // rede simulada: o estágio 3 (Anthropic) é recusado; o gancho é registrado
    fetchMock = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
  });
  afterEach(() => { delete process.env.MATCHING_ATIVO; vi.unstubAllGlobals(); });
  afterAll(async () => { delete process.env.CRON_SECRET; await pool?.end(); });

  // ─── (a) desligado ───────────────────────────────────────────────────────────────────────────
  it('(a) desligado: o cron responde sem processar nada e sem efeito colateral; sem segredo continua 401', async () => {
    await cenario();
    const res = await CRON(cronReq());
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ativo).toBe(false);
    expect(j.objects_processed).toBe(0);
    expect(j.matches_created).toBe(0);
    expect(await count('matches')).toBe(0);
    expect(await count('object_events')).toBe(0);
    expect(sent.emails.length + sent.pushes.length).toBe(0);
    expect((await CRON(cronReq('Bearer errado'))).status).toBe(401);
    expect((await CRON(new NextRequest('http://localhost/x'))).status).toBe(401);
  });

  it('(a) desligado: o gancho não chama o matching; a criação funciona como sempre', async () => {
    const u = await mkUser();
    const res = await POST(asUser('POST', u, { title: 'Mochila azul', description: 'Mochila azul com zíper', category: 'bag', status: 'lost', confirm_duplicate: true }));
    expect(res.status).toBe(201);
    expect(matchingRunCalls().length).toBe(0);
  });

  // ─── (b) ligado ──────────────────────────────────────────────────────────────────────────────
  it('(b) ligado: o gancho chama /matching/run com { objectId } (nome que a rota lê) e o token do próprio usuário', async () => {
    process.env.MATCHING_ATIVO = '1';
    const u = await mkUser();
    const res = await POST(asUser('POST', u, { title: 'Mochila azul', description: 'Mochila azul com zíper', category: 'bag', status: 'lost', confirm_duplicate: true }));
    expect(res.status).toBe(201);
    const novo = await res.json();
    const calls = matchingRunCalls();
    expect(calls.length).toBe(1);
    const init = calls[0][1] as { method: string; headers: Record<string, string>; body: string };
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ objectId: novo.id });
    expect(init.headers.Authorization).toBe(`Bearer ${u}`);
  });

  it('(b) ligado: o corpo do gancho é aceito pela rota individual (sem 400)', async () => {
    process.env.MATCHING_ATIVO = '1';
    const c = await cenario();
    const res = await RUN(asUser('POST', c.dono, { objectId: c.perdido }));
    expect(res.status).toBe(200);
    expect(await count('matches')).toBe(1);
  });

  it('(b) ligado: o cron processa e cria o match, com aviso ao dono comum', async () => {
    process.env.MATCHING_ATIVO = '1';
    const c = await cenario();
    const j = await (await CRON(cronReq())).json();
    expect(j.ok).toBe(true);
    expect(j.objects_processed).toBe(1);
    expect(j.matches_created).toBe(1);
    expect(await count('matches')).toBe(1);
    expect(sent.emails.length).toBe(1);
    expect(sent.pushes.length).toBe(1);
    expect(sent.pushes[0][0]).toBe(c.dono);
  });

  it('(b) o gancho não liga para a conta de sistema', async () => {
    process.env.MATCHING_ATIVO = '1';
    await mkUser({ system: true, id: SYSTEM_ACCOUNT_ID });
    const res = await POST(asUser('POST', SYSTEM_ACCOUNT_ID, { title: 'Mochila azul', description: 'Mochila azul com zíper', category: 'bag', status: 'lost', confirm_duplicate: true }));
    expect(res.status).toBe(201);
    expect(matchingRunCalls().length).toBe(0);
  });

  // ─── (c) conta de sistema e legado ───────────────────────────────────────────────────────────
  for (const [rotulo, dono] of [['conta de sistema', { system: true }], ['dono legado', { legacy: true }]] as const) {
    it(`(c) ${rotulo}: o match é gravado, mas ninguém é avisado (cron)`, async () => {
      process.env.MATCHING_ATIVO = '1';
      await cenario(dono);
      await CRON(cronReq());
      expect(await count('matches')).toBe(1);
      expect(sent.emails.length).toBe(0);
      expect(sent.pushes.length).toBe(0);
      expect(await count('object_events', "type = 'owner_notified'")).toBe(0);
    });
    it(`(c) ${rotulo}: sem aviso na rota individual`, async () => {
      const c = await cenario(dono);
      const res = await RUN(asUser('POST', c.dono, { objectId: c.perdido }));
      expect(res.status).toBe(200);
      expect(await count('matches')).toBe(1);
      expect(sent.emails.length).toBe(0);
      expect(sent.pushes.length).toBe(0);
    });
    it(`(c) ${rotulo}: sem aviso no run-all do administrador`, async () => {
      await cenario(dono);
      const res = await RUNALL(asUser('POST', 'admin'));
      expect(res.status).toBe(200);
      expect(await count('matches')).toBe(1);
      expect(sent.emails.length).toBe(0);
    });
  }

  it('(c) controle: dono comum é avisado na rota individual e no run-all', async () => {
    const c = await cenario();
    await RUN(asUser('POST', c.dono, { objectId: c.perdido }));
    expect(sent.emails.length).toBe(1);
    expect(sent.pushes.length).toBe(1);
    await pool.query('TRUNCATE matches');
    sent.emails.length = 0;
    await RUNALL(asUser('POST', 'admin'));
    expect(sent.emails.length).toBe(1);
  });

  it('(c) sinal público como candidato continua entrando, e o e-mail leva o título sem nome (cron e run-all)', async () => {
    const dono = await mkUser();
    const sistema = await mkUser({ system: true, id: SYSTEM_ACCOUNT_ID });
    await mkObj(dono, 'lost', { title: 'Mochila azul grande' });
    await mkObj(sistema, 'found', { title: 'Mochila azul encontrada em nome de Maria Souza Teste', source: 'public_signal' });
    process.env.MATCHING_ATIVO = '1';
    await CRON(cronReq());
    expect(await count('matches')).toBe(1);
    expect(sent.emails.length).toBe(1);
    expect(JSON.stringify(sent.emails)).not.toContain('Maria Souza Teste');
    await pool.query('TRUNCATE matches');
    sent.emails.length = 0;
    await RUNALL(asUser('POST', 'admin'));
    expect(sent.emails.length).toBe(1);
    expect(JSON.stringify(sent.emails)).not.toContain('Maria Souza Teste');
  });

  it('(c) par já avaliado (qualquer status) não volta', async () => {
    process.env.MATCHING_ATIVO = '1';
    const c = await cenario();
    await pool.query(`INSERT INTO matches (lost_object_id, found_object_id, score, status) VALUES ($1,$2,50,'rejected')`, [c.perdido, c.achado]);
    await CRON(cronReq());
    expect(await count('matches')).toBe(1);
    expect(sent.emails.length).toBe(0);
  });

  // ─── (d) botão manual e GET /matches ─────────────────────────────────────────────────────────
  it('(d) com a chave desligada, a rota individual (botão do painel) e GET /matches funcionam como hoje', async () => {
    const c = await cenario();
    const res = await RUN(asUser('POST', c.dono, { objectId: c.perdido }));
    expect(res.status).toBe(200);
    expect((await res.json()).matches.length).toBe(1);
    const lista = await MATCHES(asUser('GET', c.dono));
    expect(lista.status).toBe(200);
    expect((await lista.json()).items?.length ?? 1).toBeGreaterThanOrEqual(1);
  });

  // ─── (e) cadastro nunca falha nem demora ─────────────────────────────────────────────────────
  it('(e) ligado: falha da chamada do matching não derruba o cadastro', async () => {
    process.env.MATCHING_ATIVO = '1';
    fetchMock.mockImplementation(async (url: unknown) => { if (String(url).includes('matching/run')) throw new Error('rede caiu'); return new Response('{}', { status: 401 }); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const u = await mkUser();
    const res = await POST(asUser('POST', u, { title: 'Mochila azul', description: 'Mochila azul com zíper', category: 'bag', status: 'lost', confirm_duplicate: true }));
    expect(res.status).toBe(201);
    expect(await count('objects', `user_id = '${u}'`)).toBe(1);
    expect(log.mock.calls.some((c) => String(c[0]).includes('gancho de criação falhou'))).toBe(true); // engolido, mas registrado
    log.mockRestore();
  });

  it('(e) ligado: matching lento não segura o cadastro (espera no máximo cerca de 1 segundo)', async () => {
    process.env.MATCHING_ATIVO = '1';
    fetchMock.mockImplementation((url: unknown) => (String(url).includes('matching/run') ? new Promise(() => {}) : Promise.resolve(new Response('{}', { status: 401 }))));
    const u = await mkUser();
    const t0 = Date.now();
    const res = await POST(asUser('POST', u, { title: 'Mochila azul', description: 'Mochila azul com zíper', category: 'bag', status: 'lost', confirm_duplicate: true }));
    expect(res.status).toBe(201);
    expect(Date.now() - t0).toBeLessThan(2500);
  });

  // ─── (f) eventos ─────────────────────────────────────────────────────────────────────────────
  it('(f) ligado: o cron grava início, fim e achado, sem dado pessoal', async () => {
    process.env.MATCHING_ATIVO = '1';
    const c = await cenario();
    await CRON(cronReq());
    await new Promise((r) => setTimeout(r, 200)); // os eventos são gravados sem espera
    const ev = (await pool.query(`SELECT type, title, description, metadata FROM object_events WHERE object_id = $1 ORDER BY created_at`, [c.perdido])).rows;
    const tipos = ev.map((e) => e.type);
    expect(tipos).toContain('matching_started');
    expect(tipos).toContain('matching_completed');
    expect(tipos).toContain('match_found');
    const completo = ev.find((e) => e.type === 'matching_completed');
    expect(completo.metadata.objects_compared).toBe(1);
    const achado = ev.find((e) => e.type === 'match_found');
    expect(Object.keys(achado.metadata).sort()).toEqual(['match_id', 'score']);
    const tudo = JSON.stringify(ev);
    for (const texto of ['Mochila', 'Pessoa Teste', '@teste.invalid']) expect(tudo).not.toContain(texto);
  });
});

describe('regressão estática: interruptor, nome do campo e travas', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('o interruptor só liga com MATCHING_ATIVO igual a 1', () => {
    expect(ler('src/lib/matchingSeguranca.ts')).toMatch(/process\.env\.MATCHING_ATIVO === '1'/);
  });
  it('o gancho usa objectId e só com o interruptor', () => {
    const s = ler('src/app/api/v1/objects/route.ts');
    expect(s).toMatch(/JSON\.stringify\(\{ objectId: newObject\.id \}\)/);
    expect(s).not.toMatch(/object_id: newObject\.id/);
    expect(s).toMatch(/if \(MATCHING_ATIVO\(\) && payload\.sub !== SYSTEM_ACCOUNT_ID\)/);
  });
  it('o cron tem o interruptor e a mesma trava das outras rotas; a rota individual e o botão não dependem da chave', () => {
    expect(ler('src/app/api/v1/cron/matching/route.ts')).toMatch(/if \(!MATCHING_ATIVO\(\)\)/);
    expect(ler('src/app/api/v1/cron/matching/route.ts')).toMatch(/donoPodeSerAvisado\(owner\)/);
    expect(ler('src/app/api/v1/admin/matching/run-all/route.ts')).toMatch(/donoPodeSerAvisado\(owner\)/);
    expect(ler('src/app/api/v1/matching/run/route.ts')).not.toMatch(/MATCHING_ATIVO/);
    expect(ler('src/app/api/v1/admin/matching/run-all/route.ts')).not.toMatch(/MATCHING_ATIVO/);
    expect(ler('src/app/api/v1/matching/run/route.ts')).toMatch(/!ownerRow\.is_system_account|ownerRow && !ownerRow\.is_system_account/);
  });
  it('não mexeu em estágio 3, limiares nem vercel.json', () => {
    const m = ler('src/lib/matching.ts');
    expect(m).toMatch(/STAGE3_SEMANTIC_ACCEPT_THRESHOLD = 60/);
    expect(m).toMatch(/STAGE2_DIRECT_MATCH_CONFIDENCE = 40/);
    expect(ler('vercel.json')).not.toMatch(/crons/);
  });
});
