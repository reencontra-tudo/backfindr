// Matching: só objetos NOVOS são gatilho (corte de reativação), candidatos nunca do legado e ordem das datas pela OCORRÊNCIA.
// Postgres REAL (pula sem TEST_DATABASE_URL); e-mail, push e rede SIMULADOS. Só dados FICTÍCIOS.
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import { MATCHING_DESDE, objetoEhNovoParaMatching, diaDaOcorrencia, ordemDeDatasValida, parPodeVirarMatch, montarBuscaDeCandidatos } from '@/lib/matchingFiltro';
import { classifyStage2, semanticMatchScore } from '@/lib/matching';

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
const ANTES = '2026-11-15 23:00:00';   // antes do corte
const DEPOIS = '2026-11-16 10:00:00';  // depois do corte

describe('funções do filtro central', () => {
  it('corte: 16/11/2026 00:00 de São Paulo = 03:00 UTC', () => {
    expect(MATCHING_DESDE).toBe('2026-11-16T03:00:00Z');
    expect(objetoEhNovoParaMatching('2026-11-16 02:59:59')).toBe(false);
    expect(objetoEhNovoParaMatching('2026-11-16 03:00:00')).toBe(true);
    expect(objetoEhNovoParaMatching('2026-11-16T10:00:00Z')).toBe(true);
    expect(objetoEhNovoParaMatching('2026-08-25 12:00:00')).toBe(false);
    expect(objetoEhNovoParaMatching(null)).toBe(false);
    expect(objetoEhNovoParaMatching(undefined)).toBe(false);
  });
  it('dia da ocorrência: texto, Date local e vazio', () => {
    expect(diaDaOcorrencia('2026-11-10')).toBe('2026-11-10');
    expect(diaDaOcorrencia('2026-11-10T00:00:00.000Z')).toBe('2026-11-10');
    expect(diaDaOcorrencia(new Date(2026, 10, 10))).toBe('2026-11-10'); // pg lê DATE como meia-noite local
    expect(diaDaOcorrencia(null)).toBeNull();
    expect(diaDaOcorrencia('')).toBeNull();
  });
  it('ordem das datas: perdido/roubado só casa com achado do mesmo dia ou posterior; sem data de um lado, não filtra', () => {
    const perdido = (d: string | null, s = 'lost') => ({ status: s, occurrence_date: d });
    const achado = (d: string | null) => ({ status: 'found', occurrence_date: d });
    expect(ordemDeDatasValida(perdido('2026-11-10'), achado('2026-11-09'))).toBe(false);
    expect(ordemDeDatasValida(perdido('2026-11-10'), achado('2026-11-10'))).toBe(true);
    expect(ordemDeDatasValida(perdido('2026-11-10'), achado('2026-11-11'))).toBe(true);
    expect(ordemDeDatasValida(achado('2026-11-09'), perdido('2026-11-10'))).toBe(false);       // vale nos dois sentidos
    expect(ordemDeDatasValida(perdido('2026-11-10', 'stolen'), achado('2026-11-09'))).toBe(false); // roubado conta como perdido
    expect(ordemDeDatasValida(perdido(null), achado('2026-11-09'))).toBe(true);
    expect(ordemDeDatasValida(perdido('2026-11-10'), achado(null))).toBe(true);
    expect(ordemDeDatasValida(perdido(null), achado(null))).toBe(true);
    expect(ordemDeDatasValida({ status: 'lost', occurrence_date: '2026-11-10' }, { status: 'lost', occurrence_date: '2026-11-01' })).toBe(true); // sem achado: não julga
    expect(parPodeVirarMatch(perdido('2026-11-10'), achado('2026-11-09'))).toBe(false);
  });
  it('consulta de candidatos: leva a data do gatilho, o dono não legado e o sentido certo (achado ≥ perdido; perdido ≤ achado)', () => {
    const opc = { statuses: ['found'], categoryGroup: ['bag'], maxRadiusKm: 50, ordem: 'criacao' as const, limiteComCoordenada: 100, limiteSemCoordenada: 50, semCategoriaSemCoordenada: 'pular' as const };
    const perdido = { id: 'x', status: 'lost', occurrence_date: '2026-11-10', latitude: -23.5, longitude: -46.6, category: 'bag' };
    const b1 = montarBuscaDeCandidatos(perdido, opc)!;
    expect(b1.sql).toMatch(/occurrence_date >= \$\d+::date/);
    expect(b1.params).toContain('2026-11-10');
    expect(b1.sql).toMatch(/cu\.is_legacy IS TRUE/);
    const b2 = montarBuscaDeCandidatos({ ...perdido, status: 'found' }, { ...opc, statuses: ['lost', 'stolen'] })!;
    expect(b2.sql).toMatch(/occurrence_date <= \$\d+::date/);
    const b3 = montarBuscaDeCandidatos({ ...perdido, occurrence_date: null }, opc)!;
    expect(b3.sql).not.toMatch(/occurrence_date/); // sem data do gatilho: sem filtro de data, e created_at nunca entra como data
    expect(b3.sql).not.toMatch(/created_at\s*[<>]/);
    expect(montarBuscaDeCandidatos({ id: 'x', status: 'lost' }, { ...opc, categoryGroup: null })).toBeNull(); // sem local e sem categoria (cron): pula
  });
  it('estágio heurístico elimina o par fora de ordem, antes de pontuar', () => {
    const base = { title: 'Mochila azul grande', description: 'Mochila azul', category: 'bag', latitude: -23.5, longitude: -46.6, color: 'azul' };
    const r = classifyStage2({ ...base, status: 'lost', occurrence_date: '2026-11-10' }, { ...base, status: 'found', occurrence_date: '2026-11-09' });
    expect(r.decision).toBe('eliminated');
    expect(r.dateConflict).toBe(true);
    expect(classifyStage2({ ...base, status: 'lost', occurrence_date: '2026-11-10' }, { ...base, status: 'found', occurrence_date: '2026-11-10' }).decision).toBe('direct');
  });
  it('estágio semântico devolve 0 sem chamada externa para par fora de ordem', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', f);
    const base = { title: 'Mochila', description: 'x', category: 'bag' };
    expect(await semanticMatchScore({ ...base, status: 'lost', occurrence_date: '2026-11-10' }, { ...base, status: 'found', occurrence_date: '2026-11-09' })).toBe(0);
    expect(f).not.toHaveBeenCalled();
    await semanticMatchScore({ ...base, status: 'lost', occurrence_date: null }, { ...base, status: 'found', occurrence_date: null });
    expect(f).toHaveBeenCalled(); // sem data: segue o fluxo de sempre
    vi.unstubAllGlobals();
  });
});

describe.skipIf(!TEST_DB)('matching: objetos novos, não legados e datas da ocorrência (Postgres real)', () => {
  let pool: Pool;
  let CRON: (r: NextRequest) => Promise<Response>;
  let RUN: (r: NextRequest) => Promise<Response>;
  let RUNALL: (r: NextRequest) => Promise<Response>;

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
  const mkObj = async (userId: string, status: 'lost' | 'found' | 'stolen', over: { criado?: string; data?: string | null; legacy?: boolean; source?: string | null; title?: string } = {}) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO objects (id, user_id, title, description, status, category, type, qr_code, latitude, longitude, color, is_legacy, source, created_at, occurrence_date)
       VALUES ($1,$2,$3,'Mochila azul com zíper',$4,'bag','bag',$5,-23.5,-46.6,'azul',$6,$7,$8,$9)`,
      [id, userId, over.title ?? 'Mochila azul grande', status, randomUUID().slice(0, 8), over.legacy ?? false, over.source ?? null, over.criado ?? DEPOIS, over.data ?? null]);
    return id;
  };
  const pares = async () => (await pool.query('SELECT lost_object_id, found_object_id, status FROM matches')).rows;

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
  });
  beforeEach(async () => {
    sent.emails.length = 0; sent.pushes.length = 0;
    process.env.MATCHING_ATIVO = '1';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
  });
  afterEach(() => { delete process.env.MATCHING_ATIVO; vi.unstubAllGlobals(); });
  afterAll(async () => { delete process.env.CRON_SECRET; await pool?.end(); });

  // ─── interruptor e segredo (não mudam) ───────────────────────────────────────────────────────
  it('interruptor desligado continua sem efeito; segredo errado continua 401', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    await mkObj(dono, 'lost'); await mkObj(ach, 'found');
    delete process.env.MATCHING_ATIVO;
    const j = await (await CRON(cronReq())).json();
    expect(j.ativo).toBe(false);
    expect(await count('matches')).toBe(0);
    expect(await count('object_events')).toBe(0);
    process.env.MATCHING_ATIVO = '1';
    expect((await CRON(cronReq('Bearer errado'))).status).toBe(401);
  });

  // ─── regra A: só objetos novos disparam ──────────────────────────────────────────────────────
  it('A: objeto anterior ao corte não é processado; posterior é', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    const velho = await mkObj(dono, 'lost', { criado: ANTES });
    await mkObj(ach, 'found', { criado: ANTES });
    const j = await (await CRON(cronReq())).json();
    expect(j.objects_processed).toBe(0);
    expect(await count('matches')).toBe(0);
    expect(await count('object_events', `object_id = '${velho}'`)).toBe(0);
    const novo = await mkObj(dono, 'lost', { criado: DEPOIS, title: 'Mochila azul grande nova' });
    const j2 = await (await CRON(cronReq())).json();
    expect(j2.objects_processed).toBe(1);
    expect(await count('object_events', `object_id = '${novo}' AND type = 'matching_completed'`)).toBe(1);
  });

  it('A: objeto novo (achado) dispara contra perdido ANTIGO não legado: o gatilho é só o novo', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    const perdidoAntigo = await mkObj(dono, 'lost', { criado: ANTES });
    const achadoNovo = await mkObj(ach, 'found', { criado: DEPOIS });
    const j = await (await CRON(cronReq())).json();
    expect(j.objects_processed).toBe(1);
    expect(await pares()).toEqual([{ lost_object_id: perdidoAntigo, found_object_id: achadoNovo, status: 'pending' }]);
    expect(await count('object_events', `object_id = '${perdidoAntigo}' AND type IN ('matching_started','matching_completed')`)).toBe(0); // o antigo não foi gatilho
    expect(sent.emails.length).toBe(1); // dono comum do perdido é avisado
  });

  it('A: objeto já processado não é reprocessado (nem gera novos eventos), e par já avaliado não volta', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    await mkObj(dono, 'lost'); await mkObj(ach, 'found');
    const j1 = await (await CRON(cronReq())).json();
    expect(j1.objects_processed).toBe(2);
    expect(await count('matches')).toBe(1);
    const eventos = await count('object_events');
    sent.emails.length = 0;
    const j2 = await (await CRON(cronReq())).json();
    expect(j2.objects_processed).toBe(0);
    expect(await count('object_events')).toBe(eventos);
    expect(await count('matches')).toBe(1);
    expect(sent.emails.length).toBe(0);
    // mesmo com o match rejeitado, o objeto processado não volta e o par não é recriado
    await pool.query(`UPDATE matches SET status = 'rejected'`);
    await CRON(cronReq());
    expect(await count('matches')).toBe(1);
  });

  it('A: objeto com matching_completed (feito pela rota individual) também não é reprocessado pelo cron', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    const perdido = await mkObj(dono, 'lost'); await mkObj(ach, 'found', { criado: ANTES });
    await RUN(asUser('POST', dono, { objectId: perdido }));
    await new Promise((r) => setTimeout(r, 100));
    expect(await count('object_events', `object_id = '${perdido}' AND type = 'matching_completed'`)).toBe(1);
    const j = await (await CRON(cronReq())).json();
    expect(j.objects_processed).toBe(0);
  });

  it('A: no máximo 100 objetos por rodada, os mais antigos primeiro, sem repetir', async () => {
    const dono = await mkUser();
    for (let i = 0; i < 103; i++) await pool.query(
      `INSERT INTO objects (user_id, title, description, status, category, type, qr_code, created_at) VALUES ($1,$2,'x','lost','bag','bag',$3,$4)`,
      [dono, `Item ${i}`, `Q${String(i).padStart(7, '0')}`, `2026-11-16 10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`]);
    expect((await (await CRON(cronReq())).json()).objects_processed).toBe(100);
    expect((await (await CRON(cronReq())).json()).objects_processed).toBe(3);
    expect((await (await CRON(cronReq())).json()).objects_processed).toBe(0);
  });

  // ─── regra B: candidatos não legados ─────────────────────────────────────────────────────────
  it('B: candidato legado (objeto ou dono) é excluído; não legado entra; conta de sistema segue entrando', async () => {
    const dono = await mkUser();
    const legadoObj = await mkUser(); const legadoDono = await mkUser({ legacy: true }); const comum = await mkUser(); const sistema = await mkUser({ system: true, id: SYSTEM_ACCOUNT_ID });
    await mkObj(legadoObj, 'found', { legacy: true });                      // objeto legado
    await mkObj(legadoDono, 'found');                                       // objeto não marcado, mas de dono legado
    const entra = await mkObj(comum, 'found');                              // usuário comum
    const sinal = await mkObj(sistema, 'found', { source: 'public_signal' }); // sinal público (conta de sistema)
    const perdido = await mkObj(dono, 'lost', { criado: DEPOIS });
    await RUN(asUser('POST', dono, { objectId: perdido }));
    const achados = (await pares()).map((p) => p.found_object_id).sort();
    expect(achados).toEqual([entra, sinal].sort());
  });

  it('B: vale também no cron e no run-all do administrador', async () => {
    const dono = await mkUser(); const legadoDono = await mkUser({ legacy: true }); const comum = await mkUser();
    await mkObj(legadoDono, 'found'); const entra = await mkObj(comum, 'found', { criado: ANTES });
    const perdido = await mkObj(dono, 'lost');
    await CRON(cronReq());
    expect((await pares()).map((p) => p.found_object_id)).toEqual([entra]);
    await pool.query('TRUNCATE matches, object_events'); // o run-all só pega objetos ainda não processados
    await RUNALL(asUser('POST', 'admin'));
    expect((await pares()).map((p) => p.found_object_id)).toEqual([entra]);
    expect((await pares())[0].lost_object_id).toBe(perdido);
  });

  // ─── regra C: ordem das datas da OCORRÊNCIA ──────────────────────────────────────────────────
  for (const [rotulo, rodar] of [
    ['cron', async (_d: string, _p: string) => { await CRON(cronReq()); }],
    ['rota individual', async (d: string, p: string) => { await RUN(asUser('POST', d, { objectId: p })); }],
    ['run-all do administrador', async () => { await RUNALL(asUser('POST', 'admin')); }],
  ] as const) {
    describe(`C (${rotulo})`, () => {
      const cenario = async (dataPerdido: string | null, dataAchado: string | null, criadoPerdido = DEPOIS, criadoAchado = DEPOIS) => {
        const dono = await mkUser(); const ach = await mkUser();
        const perdido = await mkObj(dono, 'lost', { data: dataPerdido, criado: criadoPerdido });
        const achado = await mkObj(ach, 'found', { data: dataAchado, criado: criadoAchado });
        await rodar(dono, perdido);
        return { perdido, achado };
      };
      it('achado de data ANTERIOR à da perda: não casa', async () => {
        await cenario('2026-11-10', '2026-11-09');
        expect(await count('matches')).toBe(0);
      });
      it('achado do MESMO DIA ou POSTERIOR: casa', async () => {
        await cenario('2026-11-10', '2026-11-10'); expect(await count('matches')).toBe(1);
        await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
        await cenario('2026-11-10', '2026-11-12'); expect(await count('matches')).toBe(1);
      });
      it('sem a data de um dos lados: segue o fluxo de sempre (casa), sem usar o cadastro como data', async () => {
        await cenario(null, '2026-11-09'); expect(await count('matches')).toBe(1);
        await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
        await cenario('2026-11-10', null); expect(await count('matches')).toBe(1);
        await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
        await cenario(null, null); expect(await count('matches')).toBe(1);
      });
      it('o cadastro ordenaria «certo», mas a data da ocorrência ordena «errado»: NÃO cria; o inverso cria', async () => {
        // perdido cadastrado ANTES do achado (cadastro certo), mas achado ocorreu ANTES da perda (ocorrência errada)
        await cenario('2026-11-10', '2026-11-05', '2026-11-16 10:00:00', '2026-11-16 11:00:00');
        expect(await count('matches')).toBe(0);
        await pool.query('TRUNCATE object_events, matches, objects, users CASCADE');
        // achado cadastrado ANTES do perdido (cadastro «errado»), mas ocorreu DEPOIS da perda (ocorrência certa)
        await cenario('2026-11-10', '2026-11-12', '2026-11-16 11:00:00', '2026-11-16 10:00:00');
        expect(await count('matches')).toBe(1);
      });
      it('nenhum par fora de ordem é criado, nem como pendente, e ninguém é avisado', async () => {
        await cenario('2026-11-10', '2026-11-01');
        expect(await count('matches')).toBe(0);
        expect(sent.emails.length + sent.pushes.length).toBe(0);
      });
    });
  }

  it('C: com o achado como gatilho (cron), a ordem também vale', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    await mkObj(dono, 'lost', { data: '2026-11-10', criado: ANTES });
    await mkObj(ach, 'found', { data: '2026-11-09', criado: DEPOIS });
    await CRON(cronReq());
    expect(await count('matches')).toBe(0);
    await mkObj(ach, 'found', { data: '2026-11-10', criado: DEPOIS });
    await CRON(cronReq());
    expect(await count('matches')).toBe(1);
  });

  it('A: achado novo também encontra um ROUBADO antigo de usuário comum', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    const roubado = await mkObj(dono, 'stolen', { criado: ANTES });
    const achado = await mkObj(ach, 'found', { criado: DEPOIS });
    await CRON(cronReq());
    expect(await pares()).toEqual([{ lost_object_id: roubado, found_object_id: achado, status: 'pending' }]);
  });

  it('C: roubado conta como perdido', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    const roubado = await mkObj(dono, 'stolen', { data: '2026-11-10', criado: DEPOIS });
    await mkObj(ach, 'found', { data: '2026-11-09', criado: DEPOIS });
    await CRON(cronReq());
    expect(await count('matches')).toBe(0);
    void roubado;
  });

  // ─── roubado conta como perdido; achado procura perdidos E roubados; papéis do par pelo status ──────
  const destinatarios = () => sent.emails.map((e) => (e[0] as { email: string }).email);
  const emailDe = (id: string) => `${id.slice(0, 8)}@teste.invalid`;

  describe('roubado e achado: quem procura quem e quem é o perdido do par', () => {
    for (const [rotulo, rodar] of [
      ['cron', async (_d: string, _p: string) => { await CRON(cronReq()); }],
      ['rota individual (o que o gancho de criação chama)', async (d: string, p: string) => { await RUN(asUser('POST', d, { objectId: p })); }],
      ['run-all do administrador', async () => { await RUNALL(asUser('POST', 'admin')); }],
    ] as const) {
      it(`${rotulo}: roubado do usuário casa com achado e é gravado como o PERDIDO do par; o aviso vai ao dono do roubado, nunca ao do achado`, async () => {
        const dono = await mkUser(); const ach = await mkUser();
        const roubado = await mkObj(dono, 'stolen'); const achado = await mkObj(ach, 'found');
        await rodar(dono, roubado);
        expect(await pares()).toEqual([{ lost_object_id: roubado, found_object_id: achado, status: 'pending' }]);
        expect(destinatarios()).toEqual([emailDe(dono)]);
        expect(destinatarios()).not.toContain(emailDe(ach));
        if (!rotulo.startsWith('run-all')) expect(sent.pushes.map((p) => p[0])).toEqual([dono]); // o run-all do administrador só envia e-mail (como antes)
      });
    }

    it('achado novo casa com o roubado E com o perdido, cada um no papel de perdido; cada dono é avisado, o do achado não', async () => {
      const donoR = await mkUser(); const donoP = await mkUser(); const ach = await mkUser();
      const roubado = await mkObj(donoR, 'stolen', { criado: ANTES });
      const perdido = await mkObj(donoP, 'lost', { criado: ANTES });
      const achado = await mkObj(ach, 'found', { criado: DEPOIS });
      await CRON(cronReq());
      const got = (await pares()).map((p) => `${p.lost_object_id}>${p.found_object_id}`).sort();
      expect(got).toEqual([`${roubado}>${achado}`, `${perdido}>${achado}`].sort());
      expect(destinatarios().sort()).toEqual([emailDe(donoR), emailDe(donoP)].sort());
      expect(destinatarios()).not.toContain(emailDe(ach));
    });

    it('achado como gatilho na rota individual (gancho) e no run-all também encontra roubado e perdido', async () => {
      const donoR = await mkUser(); const donoP = await mkUser(); const ach = await mkUser();
      await mkObj(donoR, 'stolen'); await mkObj(donoP, 'lost');
      const achado = await mkObj(ach, 'found');
      await RUN(asUser('POST', ach, { objectId: achado }));
      expect(await count('matches')).toBe(2);
      expect(destinatarios().sort()).toEqual([emailDe(donoR), emailDe(donoP)].sort());
      expect(destinatarios()).not.toContain(emailDe(ach));
    });

    it('roubado NÃO casa mais com «perdido» (só com achado); perdido também não casa com perdido', async () => {
      const a = await mkUser(); const b = await mkUser(); const c = await mkUser();
      const roubado = await mkObj(a, 'stolen'); await mkObj(b, 'lost'); await mkObj(c, 'stolen');
      await RUN(asUser('POST', a, { objectId: roubado }));
      expect(await count('matches')).toBe(0);
      const perdido = await mkObj(b, 'lost', { title: 'Mochila azul grande outra' });
      await RUN(asUser('POST', b, { objectId: perdido }));
      expect(await count('matches')).toBe(0);
    });

    it('o roubado deixa de ficar marcado como processado sem nunca casar: a rota individual casa com o achado e o cron não reprocessa', async () => {
      const dono = await mkUser(); const ach = await mkUser();
      const roubado = await mkObj(dono, 'stolen'); const achado = await mkObj(ach, 'found', { criado: ANTES });
      await RUN(asUser('POST', dono, { objectId: roubado }));
      await new Promise((r) => setTimeout(r, 100));
      expect(await pares()).toEqual([{ lost_object_id: roubado, found_object_id: achado, status: 'pending' }]);
      expect(await count('object_events', `object_id = '${roubado}' AND type = 'matching_completed'`)).toBe(1);
      expect((await (await CRON(cronReq())).json()).objects_processed).toBe(0);
    });

    for (const [rotulo, dono] of [['conta de sistema', { system: true }], ['dono legado', { legacy: true }]] as const) {
      it(`${rotulo} dono do roubado: ninguém é avisado (rota individual e run-all)`, async () => {
        const d = await mkUser(dono); const ach = await mkUser();
        const roubado = await mkObj(d, 'stolen'); await mkObj(ach, 'found');
        await RUN(asUser('POST', d, { objectId: roubado }));
        expect(sent.emails.length + sent.pushes.length).toBe(0);
        await pool.query('TRUNCATE matches, object_events');
        await RUNALL(asUser('POST', 'admin'));
        expect(sent.emails.length + sent.pushes.length).toBe(0);
      });
    }
  });

  describe('run-all do administrador: só objetos novos, uma vez cada, sem depender do interruptor', () => {
    it('não processa objeto anterior ao corte; processa o posterior; não reprocessa; ignora o interruptor', async () => {
      delete process.env.MATCHING_ATIVO; // o botão não depende da chave
      const dono = await mkUser(); const ach = await mkUser();
      const velho = await mkObj(dono, 'lost', { criado: ANTES });
      await mkObj(ach, 'found', { criado: ANTES });
      let j = await (await RUNALL(asUser('POST', 'admin'))).json();
      expect(j.objects_processed).toBe(0);
      expect(await count('matches')).toBe(0);
      expect(await count('object_events', `object_id = '${velho}'`)).toBe(0);
      const novo = await mkObj(dono, 'stolen', { criado: DEPOIS, title: 'Mochila azul grande nova' });
      j = await (await RUNALL(asUser('POST', 'admin'))).json();
      expect(j.objects_processed).toBe(1);
      expect(await count('matches')).toBe(1);
      expect(await count('object_events', `object_id = '${novo}' AND type = 'matching_completed'`)).toBe(1);
      j = await (await RUNALL(asUser('POST', 'admin'))).json();
      expect(j.objects_processed).toBe(0);
      expect(await count('matches')).toBe(1);
    });
    it('considera também achado e roubado como gatilho (como o cron)', async () => {
      const donoR = await mkUser(); const ach = await mkUser();
      const roubado = await mkObj(donoR, 'stolen', { criado: ANTES }); const achado = await mkObj(ach, 'found', { criado: DEPOIS });
      const j = await (await RUNALL(asUser('POST', 'admin'))).json();
      expect(j.objects_processed).toBe(1); // só o achado é novo
      expect(await pares()).toEqual([{ lost_object_id: roubado, found_object_id: achado, status: 'pending' }]); // o gatilho é o achado, mas o perdido do par é o roubado
      expect(destinatarios()).toEqual([emailDe(donoR)]);                                                        // o aviso vai ao dono do roubado, não ao do achado
    });
    it('a rota individual NÃO tem o corte: o dono (ou o administrador) pode pedir um objeto antigo', async () => {
      const dono = await mkUser(); const ach = await mkUser();
      const velho = await mkObj(dono, 'stolen', { criado: ANTES }); const achado = await mkObj(ach, 'found', { criado: ANTES });
      await RUN(asUser('POST', dono, { objectId: velho }));
      expect(await pares()).toEqual([{ lost_object_id: velho, found_object_id: achado, status: 'pending' }]);
    });
    it('objeto já processado pelo cron não é reprocessado pelo run-all, e vice-versa', async () => {
      const dono = await mkUser(); const ach = await mkUser();
      await mkObj(dono, 'lost'); await mkObj(ach, 'found');
      await CRON(cronReq());
      expect((await (await RUNALL(asUser('POST', 'admin'))).json()).objects_processed).toBe(0);
    });
  });

  it('notificação não muda: dono comum do perdido é avisado; conta de sistema e legado não', async () => {
    const dono = await mkUser(); const ach = await mkUser();
    await mkObj(dono, 'lost'); await mkObj(ach, 'found');
    await CRON(cronReq());
    expect(sent.emails.length).toBe(1);
    expect(sent.pushes.length).toBe(1);
    expect(sent.pushes[0][0]).toBe(dono);
  });
});

describe('regressão estática', () => {
  const ler = (p: string) => readFileSync(p, 'utf8');
  it('as consultas de candidatos dos três caminhos usam o filtro central; o cron usa os gatilhos centrais', () => {
    for (const f of ['src/app/api/v1/cron/matching/route.ts', 'src/app/api/v1/matching/run/route.ts', 'src/app/api/v1/admin/matching/run-all/route.ts']) {
      const s = ler(f);
      expect(s).toMatch(/montarBuscaDeCandidatos/);
      expect(s).toMatch(/if \(!parPodeVirarMatch\(object, candidate\)\) (continue|return);/); // guarda final antes de gravar o par
      expect(s).not.toMatch(/AND is_legacy = false\s*\n\s*\$\{categoryFilter\}/);
    }
    expect(ler('src/app/api/v1/cron/matching/route.ts')).toMatch(/buscarGatilhosNovos/);
  });
  it('as regras vivem num só arquivo e os estágios 2 e 3 chamam a ordem das datas', () => {
    const m = ler('src/lib/matching.ts');
    expect((m.match(/parAutomaticoPermitido\(obj, candidate\)/g) ?? []).length).toBe(2); // regras C e D nos estágios 2 e 3
    expect(ler('src/lib/matchingFiltro.ts')).toMatch(/MATCHING_DESDE = '2026-11-16T03:00:00Z'/);
  });
  it('estágio 3 e limiares não mudaram', () => {
    const m = ler('src/lib/matching.ts');
    expect(m).toMatch(/STAGE3_SEMANTIC_ACCEPT_THRESHOLD = 60/);
    expect(m).toMatch(/STAGE2_DIRECT_MATCH_CONFIDENCE = 40/);
  });
});
