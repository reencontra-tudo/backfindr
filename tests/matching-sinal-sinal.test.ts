// Ocorrência pública × ocorrência pública NUNCA vira match AUTOMÁTICO (só o administrador, manualmente, pode unir dois sinais).
// Postgres REAL (pula sem TEST_DATABASE_URL); e-mail, push e rede SIMULADOS. Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import { ehSinalPublico, parEhSinalComSinal, parAutomaticoPermitido, parPodeVirarMatch, montarBuscaDeCandidatos } from '@/lib/matchingFiltro';
import { classifyStage2, semanticMatchScore } from '@/lib/matching';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['matches', 'object_events', 'objects', 'users'];

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
const DEPOIS = '2026-11-16 10:00:00';

describe('funções do filtro: sinal público', () => {
  it('sinal = source public_signal OU dono conta de sistema', () => {
    expect(ehSinalPublico({ source: 'public_signal', user_id: 'x' })).toBe(true);
    expect(ehSinalPublico({ source: null, user_id: SYSTEM_ACCOUNT_ID })).toBe(true);
    expect(ehSinalPublico({ source: null, user_id: 'comum' })).toBe(false);
    expect(ehSinalPublico({ source: 'webjetos', user_id: 'comum' })).toBe(false);
    expect(ehSinalPublico({})).toBe(false);
  });
  it('sinal × sinal nunca forma par automático; sinal × usuário e usuário × usuário formam', () => {
    const sinal = (s: string) => ({ source: 'public_signal', user_id: SYSTEM_ACCOUNT_ID, status: s });
    const usuario = (s: string) => ({ source: null, user_id: 'u1', status: s });
    expect(parEhSinalComSinal(sinal('lost'), sinal('found'))).toBe(true);
    expect(parAutomaticoPermitido(sinal('lost'), sinal('found'))).toBe(false);
    expect(parPodeVirarMatch(sinal('lost'), sinal('found'))).toBe(false);
    expect(parPodeVirarMatch(sinal('lost'), usuario('found'))).toBe(true);
    expect(parPodeVirarMatch(usuario('lost'), sinal('found'))).toBe(true);
    expect(parPodeVirarMatch(usuario('stolen'), usuario('found'))).toBe(true);
  });
  it('estágio heurístico elimina sinal × sinal mesmo com tudo igual (nota alta, mesmo bairro)', () => {
    const base = { title: 'Cachorro Rex encontrado no bairro Centro', description: 'Cachorro Rex', category: 'pet', latitude: -23.5, longitude: -46.6, color: 'caramelo', source: 'public_signal', user_id: SYSTEM_ACCOUNT_ID };
    expect(classifyStage2({ ...base, status: 'lost' }, { ...base, status: 'found' }).decision).toBe('eliminated');
    expect(classifyStage2({ ...base, status: 'lost', source: null, user_id: 'u1' }, { ...base, status: 'found' }).decision).toBe('direct');
  });
  it('estágio semântico devolve 0 sem chamada externa para sinal × sinal', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', f);
    const sinal = { source: 'public_signal', user_id: SYSTEM_ACCOUNT_ID, title: 'x', description: 'x', category: 'pet' };
    expect(await semanticMatchScore({ ...sinal, status: 'lost' }, { ...sinal, status: 'found' })).toBe(0);
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('consulta de candidatos: gatilho sinal exclui sinais; gatilho de usuário não exclui', () => {
    const opc = { statuses: ['found'], categoryGroup: ['pet'], maxRadiusKm: 50, ordem: 'criacao' as const, limiteComCoordenada: 100, limiteSemCoordenada: 50, semCategoriaSemCoordenada: 'pular' as const };
    const sinal = montarBuscaDeCandidatos({ id: 'a', status: 'lost', source: 'public_signal', user_id: SYSTEM_ACCOUNT_ID, latitude: -23.5, longitude: -46.6 }, opc)!;
    expect(sinal.sql).toMatch(/source IS DISTINCT FROM 'public_signal'/);
    expect(sinal.params).toContain(SYSTEM_ACCOUNT_ID);
    const usuario = montarBuscaDeCandidatos({ id: 'b', status: 'lost', source: null, user_id: 'u1', latitude: -23.5, longitude: -46.6 }, opc)!;
    expect(usuario.sql).not.toMatch(/public_signal/);
  });
});

describe.skipIf(!TEST_DB)('sinal × sinal nos caminhos automáticos (Postgres real)', () => {
  let pool: Pool;
  let CRON: (r: NextRequest) => Promise<Response>;
  let RUN: (r: NextRequest) => Promise<Response>;
  let RUNALL: (r: NextRequest) => Promise<Response>;
  let ADMIN_PATCH: (r: NextRequest, c: { params: { id: string } }) => Promise<Response>;

  const cronReq = (auth = `Bearer ${SEGREDO_FALSO_DE_TESTE}`) => new NextRequest('http://localhost/api/v1/cron/matching', { headers: { authorization: auth } });
  const asUser = (method: string, uid: string, body?: unknown) =>
    new NextRequest('http://localhost/x', { method, headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const count = async (t: string, where = 'true') => Number((await pool.query(`SELECT COUNT(*) FROM ${t} WHERE ${where}`)).rows[0].count);
  const emailDe = (id: string) => `${id.slice(0, 8)}@teste.invalid`;
  const destinatarios = () => sent.emails.map((e) => (e[0] as { email: string }).email);
  const pares = async () => (await pool.query('SELECT lost_object_id, found_object_id, status FROM matches')).rows;

  const mkUser = async (over: { system?: boolean; id?: string } = {}) => {
    const id = over.id ?? randomUUID();
    await pool.query(`INSERT INTO users (id, name, email, plan, is_legacy, is_system_account) VALUES ($1,'Pessoa Teste',$2,'business',false,$3)`, [id, emailDe(id), over.system ?? false]);
    return id;
  };
  let sistema: string;
  const mkObj = async (userId: string, status: 'lost' | 'found' | 'stolen', over: { sinal?: boolean } = {}) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO objects (id, user_id, title, description, status, category, type, qr_code, latitude, longitude, color, is_legacy, source, created_at)
       VALUES ($1,$2,'Mochila azul grande','Mochila azul com zíper',$3,'bag','bag',$4,-23.5,-46.6,'azul',false,$5,$6)`,
      [id, userId, status, randomUUID().slice(0, 8), over.sinal ? 'public_signal' : null, DEPOIS]);
    return id;
  };
  const caminhos: Array<[string, (donoId: string, objId: string) => Promise<void>]> = [
    ['cron', async () => { await CRON(cronReq()); }],
    ['rota individual (também o gancho de criação)', async (d, o) => { await RUN(asUser('POST', d, { objectId: o })); }],
    ['run-all do administrador', async () => { await RUNALL(asUser('POST', 'admin')); }],
  ];

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
      found_pending_confirmation boolean DEFAULT false, found_pending_since timestamp, occurrence_date date)`);
    await pool.query(`CREATE TABLE matches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lost_object_id uuid REFERENCES objects(id) ON DELETE CASCADE,
      found_object_id uuid REFERENCES objects(id) ON DELETE CASCADE, score integer, status varchar, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), user_id uuid, notified_at timestamp)`);
    await pool.query(`CREATE TABLE object_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL, type text NOT NULL, title text NOT NULL, description text, source text NOT NULL DEFAULT 'system',
      actor_type text, actor_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now())`);
    process.env.CRON_SECRET = SEGREDO_FALSO_DE_TESTE;
    ({ GET: CRON } = await import('@/app/api/v1/cron/matching/route'));
    ({ POST: RUN } = await import('@/app/api/v1/matching/run/route'));
    ({ POST: RUNALL } = await import('@/app/api/v1/admin/matching/run-all/route'));
    ({ PATCH: ADMIN_PATCH } = await import('@/app/api/v1/admin/matches/[id]/route'));
  });
  beforeEach(async () => {
    sent.emails.length = 0; sent.pushes.length = 0;
    process.env.MATCHING_ATIVO = '1';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
    sistema = await mkUser({ system: true, id: SYSTEM_ACCOUNT_ID });
  });
  afterEach(() => { delete process.env.MATCHING_ATIVO; vi.unstubAllGlobals(); });
  afterAll(async () => { delete process.env.CRON_SECRET; await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end(); });

  for (const [rotulo, rodar] of caminhos) {
    describe(rotulo, () => {
      it('sinal × sinal NÃO gera match, nem pendente, mesmo com título, cor e bairro iguais; ninguém é avisado', async () => {
        const perdido = await mkObj(sistema, 'lost', { sinal: true });
        await mkObj(sistema, 'found', { sinal: true });
        await rodar(sistema, perdido);
        expect(await count('matches')).toBe(0);
        expect(sent.emails.length + sent.pushes.length).toBe(0);
      });
      it('sinal × sinal NÃO gera match com roubado-de-sinal também', async () => {
        const roubado = await mkObj(sistema, 'stolen', { sinal: true });
        await mkObj(sistema, 'found', { sinal: true });
        await rodar(sistema, roubado);
        expect(await count('matches')).toBe(0);
      });
      it('usuário comum perdido × sinal achado continua gerando, e o dono comum é avisado', async () => {
        const dono = await mkUser();
        const perdido = await mkObj(dono, 'lost');
        const achado = await mkObj(sistema, 'found', { sinal: true });
        await rodar(dono, perdido);
        expect(await pares()).toEqual([{ lost_object_id: perdido, found_object_id: achado, status: 'pending' }]);
        expect(destinatarios()).toEqual([emailDe(dono)]);
      });
      it('sinal perdido × usuário achado continua gerando, sem aviso a ninguém (dono do perdido é a conta de sistema)', async () => {
        const ach = await mkUser();
        const perdido = await mkObj(sistema, 'lost', { sinal: true });
        const achado = await mkObj(ach, 'found');
        await rodar(sistema, perdido);
        expect(await pares()).toEqual([{ lost_object_id: perdido, found_object_id: achado, status: 'pending' }]);
        expect(sent.emails.length + sent.pushes.length).toBe(0);
      });
      it('usuário × usuário e roubado como perdido continuam', async () => {
        const a = await mkUser(); const b = await mkUser();
        const roubado = await mkObj(a, 'stolen'); const achado = await mkObj(b, 'found');
        await rodar(a, roubado);
        expect(await pares()).toEqual([{ lost_object_id: roubado, found_object_id: achado, status: 'pending' }]);
        expect(destinatarios()).toEqual([emailDe(a)]);
      });
      it('objeto da conta de sistema que NÃO é sinal (source nulo) também não forma par com sinal, mas forma com usuário', async () => {
        const doSistema = await mkObj(sistema, 'lost');            // dono = conta de sistema, source nulo
        await mkObj(sistema, 'found', { sinal: true });
        await rodar(sistema, doSistema);
        expect(await count('matches')).toBe(0);                    // conta como sinal: nenhum par automático com outro sinal
        const ach = await mkUser(); const achado = await mkObj(ach, 'found');
        await pool.query('TRUNCATE object_events');
        await rodar(sistema, doSistema);
        expect((await pares()).map((p) => p.found_object_id)).toEqual([achado]);
      });
    });
  }

  it('cron: um sinal novo (achado) é gatilho contra perdidos de usuário, e NÃO contra perdidos de sinal', async () => {
    const dono = await mkUser();
    const doUsuario = await mkObj(dono, 'lost');
    await mkObj(sistema, 'lost', { sinal: true });
    const sinalAchado = await mkObj(sistema, 'found', { sinal: true });
    await CRON(cronReq());
    expect(await pares()).toEqual([{ lost_object_id: doUsuario, found_object_id: sinalAchado, status: 'pending' }]);
    expect(destinatarios()).toEqual([emailDe(dono)]);
  });

  it('interruptor desligado e segredo errado continuam como antes', async () => {
    await mkObj(sistema, 'lost', { sinal: true }); const u = await mkUser(); await mkObj(u, 'found');
    delete process.env.MATCHING_ATIVO;
    expect((await (await CRON(cronReq())).json()).ativo).toBe(false);
    expect(await count('matches')).toBe(0);
    process.env.MATCHING_ATIVO = '1';
    expect((await CRON(cronReq('Bearer errado'))).status).toBe(401);
  });

  it('o administrador continua podendo mexer num par sinal × sinal que já exista (a regra só barra o algoritmo)', async () => {
    const perdido = await mkObj(sistema, 'lost', { sinal: true });
    const achado = await mkObj(sistema, 'found', { sinal: true });
    const par = (await pool.query(`INSERT INTO matches (lost_object_id, found_object_id, score, status) VALUES ($1,$2,80,'pending') RETURNING id`, [perdido, achado])).rows[0].id;
    const res = await ADMIN_PATCH(asUser('PATCH', 'admin', { status: 'confirmed' }), { params: { id: par } });
    expect(res.status).toBe(200);
    expect((await pares())[0].status).toBe('confirmed');
    expect(sent.emails.length + sent.pushes.length).toBe(0);
  });
});

describe('regressão estática', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('só os três caminhos automáticos gravam pares, e todos passam pela guarda final', () => {
    const arquivos = execSync(`grep -rl "INSERT INTO matches" src --include=*.ts || true`, { encoding: 'utf8' }).trim().split('\n').sort();
    expect(arquivos).toEqual(['src/app/api/v1/admin/matching/run-all/route.ts', 'src/app/api/v1/cron/matching/route.ts', 'src/app/api/v1/matching/run/route.ts']);
    for (const f of arquivos) expect(ler(f)).toMatch(/if \(!parPodeVirarMatch\(object, candidate\)\) (continue|return);/);
  });
  it('os estágios 2 e 3 usam a mesma permissão do algoritmo', () => {
    expect((ler('src/lib/matching.ts').match(/parAutomaticoPermitido\(obj, candidate\)/g) ?? []).length).toBe(2);
  });
  it('as rotas de administrador de matches (listar, mudar status, tentativas de contato) não usam o filtro automático', () => {
    for (const f of ['src/app/api/v1/admin/matches/route.ts', 'src/app/api/v1/admin/matches/[id]/route.ts', 'src/app/api/v1/admin/matches/[id]/contact-attempts/route.ts']) {
      expect(ler(f)).not.toMatch(/matchingFiltro|parPodeVirarMatch/);
    }
  });
});
