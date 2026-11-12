// Registro de «escaneamentos»: abertura de página x escaneamento real.
//  - GET /api/v1/objects/scan/[code]: NÃO grava mais a abertura de página de objeto do LEGADO (objeto ou dono legado)
//    nem de SINAL PÚBLICO; usuário continua gravando como antes; a RESPOSTA é a mesma.
//  - GET /api/v1/objects/[id]/events (Central de Atividade do dono): conta e lista só escaneamento REAL (metadata.via).
//  - POST …/notify (aviso ao dono) e os eventos de QR gerado/baixado/impresso NÃO mudam (ver também scan-endpoints.test.ts).
// Usa um Postgres REAL. Sem TEST_DATABASE_URL a suíte é pulada. ATENÇÃO: recria users, objects e object_events (banco descartável).
//
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest@2 run --config tests/vitest.config.ts tests/scan-registro.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// O token de teste é o próprio user_id.
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));

const OWNER = '00000000-0000-0000-0000-0000000000a1';
const LEGACY_OWNER = '00000000-0000-0000-0000-0000000000b2';
const IDS = {
  user:        '10000000-0000-0000-0000-000000000001',
  legacy:      '10000000-0000-0000-0000-000000000002',
  legacyOwner: '10000000-0000-0000-0000-000000000003',
  signal:      '10000000-0000-0000-0000-000000000004',
};
const RESPONSE_KEYS = ['id', 'title', 'description', 'status', 'category', 'unique_code', 'photos', 'location', 'color', 'brand',
  'pet_breed', 'is_legacy', 'source', 'reward_amount', 'reward_description', 'created_at', 'updated_at'].sort();

describe.skipIf(!TEST_DB)('registro de escaneamentos', () => {
  let pool: Pool;
  let scanGET: (r: NextRequest, c: { params: { code: string } }) => Promise<Response>;
  let eventsGET: (r: NextRequest, c: { params: { id: string } }) => Promise<Response>;

  const events = async (objectId: string) =>
    (await pool.query('SELECT type, metadata FROM object_events WHERE object_id = $1 ORDER BY id', [objectId])).rows;
  const scan = async (code: string) => {
    const res = await scanGET(new NextRequest(`http://localhost/api/v1/objects/scan/${code}`), { params: { code } });
    await new Promise((r) => setTimeout(r, 150)); // o registro do evento é «fire-and-forget»
    return res;
  };
  const centro = async (objectId: string, userId = OWNER) => {
    const res = await eventsGET(new NextRequest('http://localhost/x', { headers: { authorization: `Bearer ${userId}` } }), { params: { id: objectId } });
    return { res, body: await res.json() };
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    ({ GET: scanGET } = await import('@/app/api/v1/objects/scan/[code]/route'));
    ({ GET: eventsGET } = await import('@/app/api/v1/objects/[id]/events/route'));
  });
  beforeEach(async () => {
    await pool.query(`
      DROP TABLE IF EXISTS object_events, objects, users CASCADE;
      CREATE TABLE users (id uuid PRIMARY KEY, is_legacy boolean DEFAULT false);
      CREATE TABLE objects (id uuid PRIMARY KEY, user_id uuid, title varchar, description text, status varchar, type varchar, location varchar,
        latitude numeric, longitude numeric, qr_code varchar, images jsonb, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
        category varchar, color varchar, brand varchar, breed varchar, is_legacy boolean DEFAULT false, source varchar,
        reward_amount numeric, reward_description text);
      CREATE TABLE object_events (id serial PRIMARY KEY, object_id uuid, type text, title text, description text, source text,
        actor_type text, actor_id text, user_id uuid, metadata jsonb, created_at timestamptz DEFAULT now());
      INSERT INTO users (id, is_legacy) VALUES ('${OWNER}', false), ('${LEGACY_OWNER}', true);
      INSERT INTO objects (id, user_id, title, status, category, qr_code, is_legacy, source, images) VALUES
        ('${IDS.user}', '${OWNER}', 'Mochila do usuário', 'lost', 'bag', 'USR1', false, NULL, '[]'),
        ('${IDS.legacy}', '${OWNER}', 'Objeto legado', 'lost', 'phone', 'LEG1', true, NULL, '[]'),
        ('${IDS.legacyOwner}', '${LEGACY_OWNER}', 'Objeto de dono legado', 'lost', 'phone', 'LEG2', false, NULL, '[]'),
        ('${IDS.signal}', NULL, 'Sinal público', 'found', 'pet', 'SIG1', false, 'public_signal', '[]');`);
  });
  afterAll(async () => { await pool?.end(); });

  describe('GET /objects/scan/[code]', () => {
    it('USUÁRIO: continua gravando 1 evento de abertura de página (sem via), como antes', async () => {
      const res = await scan('USR1');
      expect(res.status).toBe(200);
      const ev = await events(IDS.user);
      expect(ev).toHaveLength(1);
      expect(ev[0].type).toBe('qr_scanned');
      expect(ev[0].metadata).toEqual({});
    });
    it('LEGADO (objeto legado): NÃO grava nada', async () => {
      expect((await scan('LEG1')).status).toBe(200);
      expect(await events(IDS.legacy)).toHaveLength(0);
    });
    it('LEGADO (objeto não marcado, mas dono legado): NÃO grava nada', async () => {
      expect((await scan('LEG2')).status).toBe(200);
      expect(await events(IDS.legacyOwner)).toHaveLength(0);
    });
    it('SINAL PÚBLICO: NÃO grava nada', async () => {
      expect((await scan('SIG1')).status).toBe(200);
      expect(await events(IDS.signal)).toHaveLength(0);
    });
    it('objeto inexistente: 404 e nada gravado', async () => {
      expect((await scan('NAO')).status).toBe(404);
      expect((await pool.query('SELECT count(*)::int n FROM object_events')).rows[0].n).toBe(0);
    });
    it('a RESPOSTA é a mesma para todos (mesmos campos; o campo novo de apoio não vaza)', async () => {
      for (const code of ['USR1', 'LEG1', 'LEG2', 'SIG1']) {
        const body = await (await scan(code)).json();
        expect(Object.keys(body).sort(), code).toEqual(RESPONSE_KEYS);
        expect(body).not.toHaveProperty('legacy_blocked');
        expect(body.unique_code).toBe(code);
      }
      const legacy = await (await scan('LEG1')).json();
      expect(legacy.is_legacy).toBe(true);
      expect((await (await scan('SIG1')).json()).source).toBe('public_signal');
    });
    it('abrir várias vezes um objeto de usuário segue gravando (comportamento mantido); legado e sinal seguem em zero', async () => {
      for (let i = 0; i < 3; i++) { await scan('USR1'); await scan('LEG1'); await scan('SIG1'); }
      expect(await events(IDS.user)).toHaveLength(3);
      expect(await events(IDS.legacy)).toHaveLength(0);
      expect(await events(IDS.signal)).toHaveLength(0);
    });
  });

  describe('Central de Atividade (GET /objects/[id]/events)', () => {
    const ins = (type: string, metadata: object | null, minutesAgo: number, objectId = IDS.user) =>
      pool.query(`INSERT INTO object_events (object_id, type, title, source, metadata, created_at) VALUES ($1, $2, $3, 'test', $4, now() - ($5 || ' minutes')::interval)`,
        [objectId, type, `t-${type}`, metadata === null ? null : JSON.stringify(metadata), String(minutesAgo)]);

    it('conta só escaneamento real (com via); abertura de página não conta', async () => {
      for (let i = 0; i < 5; i++) await ins('qr_scanned', {}, 10 + i);          // abertura de página
      await ins('qr_scanned', null, 20);                                        // abertura de página (metadata nulo)
      await ins('qr_scanned', { via: 'find_report' }, 30);                      // real
      await ins('qr_scanned', { via: 'protected_scan' }, 40);                   // real
      const { res, body } = await centro(IDS.user);
      expect(res.status).toBe(200);
      expect(body.summary.total_scans).toBe(2);
    });
    it('a linha do tempo não mostra abertura de página e não deixa os eventos de verdade para fora (limite de 20)', async () => {
      await ins('object_created', {}, 5000);
      await ins('qr_scanned', { via: 'find_report' }, 4000);
      for (let i = 0; i < 40; i++) await ins('qr_scanned', {}, i + 1);         // 40 aberturas MAIS RECENTES que tudo
      const { body } = await centro(IDS.user);
      const types = body.events.map((e: { type: string }) => e.type);
      expect(types).toEqual(['qr_scanned', 'object_created']);                  // só o real e o cadastro; nada de abertura
      expect(body.events[0].metadata.via).toBe('find_report');
    });
    it('«última atividade» ignora abertura de página', async () => {
      await ins('object_created', {}, 600);
      await ins('qr_scanned', {}, 1);
      const { body } = await centro(IDS.user);
      const ageMin = (Date.now() - new Date(body.summary.last_activity).getTime()) / 60000;
      expect(ageMin).toBeGreaterThan(590);
    });
    it('outros eventos (comparações IA, correspondências, QR gerado/baixado/impresso, aviso ao dono) seguem contados e listados', async () => {
      for (const t of ['matching_started', 'matching_completed', 'match_found', 'qr_generated', 'qr_downloaded', 'qr_printed', 'owner_notified', 'shared_link_opened'])
        await ins(t, {}, 10);
      const { body } = await centro(IDS.user);
      expect(body.summary.total_ai_runs).toBe(2);
      expect(body.summary.total_matches).toBe(1);
      expect(body.events.map((e: { type: string }) => e.type).sort()).toEqual(
        ['match_found', 'matching_completed', 'matching_started', 'owner_notified', 'qr_downloaded', 'qr_generated', 'qr_printed', 'shared_link_opened']);
    });
    it('objeto sem nenhuma abertura de página: resposta igual à de antes (mesma contagem e mesma lista)', async () => {
      await ins('object_created', {}, 100); await ins('match_found', {}, 50); await ins('qr_scanned', { via: 'find_report' }, 10);
      const { body } = await centro(IDS.user);
      expect(body.summary.total_scans).toBe(1);
      expect(body.events.map((e: { type: string }) => e.type)).toEqual(['qr_scanned', 'match_found', 'object_created']);
    });
    it('continua exigindo dono e login', async () => {
      expect((await eventsGET(new NextRequest('http://localhost/x'), { params: { id: IDS.user } })).status).toBe(401);
      expect((await centro(IDS.user, LEGACY_OWNER)).res.status).toBe(404);
    });
    it('nada é apagado: os registros antigos de abertura de página continuam no banco', async () => {
      for (let i = 0; i < 4; i++) await ins('qr_scanned', {}, i + 1);
      await centro(IDS.user);
      expect(await events(IDS.user)).toHaveLength(4);
    });
  });
});
