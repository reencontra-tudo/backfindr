// Programa de Colaboradores, E1: atribuição gravada na ocorrência. Postgres REAL (sem TEST_DATABASE_URL a suíte é pulada).
// Aplica a migration 026 de verdade sobre um objects mínimo e exercita POST /api/v1/objects e GET /api/v1/colaboradores/validar.
// ATENÇÃO: recria users, objects e colaboradores no banco de teste.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));
vi.mock('@/lib/events', () => {
  const noop = () => Promise.resolve();
  return { Events: { objectCreated: noop, objectPublished: noop, objectIndexed: noop, qrGenerated: noop } };
});
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));

const MIGRATION = readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8');

describe.skipIf(!TEST_DB)('Programa de Colaboradores E1 — atribuição na ocorrência', () => {
  let pool: Pool;
  let POST: (req: NextRequest) => Promise<Response>;
  let VALIDAR: (req: NextRequest) => Promise<Response>;
  let resetLimite: () => void;
  let userId: string;
  const ids: Record<string, string> = {};

  const post = (uid: string, body: Record<string, unknown>) => POST(new NextRequest('http://localhost/api/v1/objects', {
    method: 'POST', headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  const corpo = (over: Record<string, unknown> = {}) => ({ title: `Chaves ${randomUUID().slice(0, 8)}`, description: `Molho com chaveiro ${randomUUID().slice(0, 8)} azul`, category: 'keys', status: 'lost', ...over });   // título e descrição únicos: não disparam o aviso de objeto parecido
  const linha = async (id: string) => (await pool.query('SELECT * FROM objects WHERE id = $1', [id])).rows[0];
  const total = async () => Number((await pool.query('SELECT COUNT(*) FROM objects')).rows[0].count);
  const validar = (codigo: string, ip = '10.0.0.1') => VALIDAR(new NextRequest(`http://localhost/api/v1/colaboradores/validar?codigo=${encodeURIComponent(codigo)}`, { headers: { 'x-real-ip': ip } }));

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await pool.query('DROP TABLE IF EXISTS objects, colaboradores, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, plan text, plan_expires_at timestamptz)`);
    await pool.query(`CREATE TABLE objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar NOT NULL, description text, status varchar DEFAULT 'lost',
      type varchar NOT NULL, location varchar, latitude numeric, longitude numeric,
      qr_code varchar NOT NULL UNIQUE, images jsonb DEFAULT '[]', created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(), category varchar, is_public boolean DEFAULT true,
      reward_amount numeric, reward_description text, category_fields jsonb DEFAULT '{}',
      subject_name varchar, document_type varchar, is_legacy boolean DEFAULT false)`); // is_legacy: a rota conta só objetos não legados (PL-01)
    await pool.query(MIGRATION);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    ({ POST } = await import('@/app/api/v1/objects/route'));
    ({ GET: VALIDAR } = await import('@/app/api/v1/colaboradores/validar/route'));
    ({ resetLimiteValidacao: resetLimite } = await import('@/lib/colaboradores/limite'));
  });
  afterAll(async () => { await pool?.end(); });

  beforeEach(async () => {
    await pool.query('DELETE FROM objects');
    await pool.query('ALTER TABLE colaboradores DISABLE TRIGGER trg_colaboradores_sem_delete');
    await pool.query('DELETE FROM colaboradores');
    await pool.query('ALTER TABLE colaboradores ENABLE TRIGGER trg_colaboradores_sem_delete');
    await pool.query('DELETE FROM users');
    userId = randomUUID();
    await pool.query('INSERT INTO users (id, plan) VALUES ($1, $2)', [userId, 'business']);
    const mk = async (slug: string, curto: string, nome: string, estado = 'ativo', interno = false) => {
      const r = await pool.query(`INSERT INTO colaboradores (slug, codigo_curto, nome, estado, interno) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [slug, curto, nome, estado, interno]);
      ids[slug] = r.rows[0].id;
    };
    await mk('backfindr', 'ZL27', 'Backfindr', 'ativo', true);
    await mk('grupo-susp', 'SUSP', 'Grupo suspenso', 'suspenso');
    await mk('grupo-saiu', 'SAAU', 'Grupo que saiu', 'saiu');
    await mk('grupo-excl', 'EXCL', 'Grupo excluído', 'excluido');
    resetLimite();
    delete process.env.COLABORADORES_ATIVO;
  });
  afterEach(() => { delete process.env.COLABORADORES_ATIVO; });

  describe('SEM código de colaborador: exatamente como hoje (interruptor desligado e ligado)', () => {
    for (const ligado of [false, true]) {
      it(`interruptor ${ligado ? 'LIGADO' : 'DESLIGADO'}: cria 201, atribuição nula, mesmos campos de resposta`, async () => {
        if (ligado) process.env.COLABORADORES_ATIVO = '1';
        const r = await post(userId, corpo({ pet_species: 'cao', latitude: -23.5, longitude: -46.6, location: 'Rua A, São Paulo', reward_amount: 10 }));
        expect(r.status).toBe(201);
        const j = await r.json();
        // Mesmos campos de resposta que a rota já devolvia (normalizeObject não foi alterado): nenhum campo novo, nem colaborador_*.
        expect(Object.keys(j).sort()).toEqual(['category', 'category_fields', 'created_at', 'description', 'found_pending_confirmation', 'id', 'location', 'photos', 'reward_amount', 'reward_description', 'status', 'title', 'unique_code', 'updated_at']);
        expect(j).not.toHaveProperty('colaborador_id');
        expect(j).not.toHaveProperty('colaborador_codigo');
        const row = await linha(j.id);
        expect(row.colaborador_id).toBeNull();
        expect(row.colaborador_codigo).toBeNull();
        // Comportamento atual, NÃO alterado: campos desconhecidos (e latitude/longitude, que a rota também não separa) continuam indo para category_fields.
        expect(row.category_fields).toEqual({ latitude: -23.5, longitude: -46.6, pet_species: 'cao' });
        expect(row.is_public).toBe(true);
        expect(row.status).toBe('lost');
      });
    }

    it('os resultados com o interruptor desligado e ligado são idênticos (mesmo corpo → mesma linha, exceto id, qr e datas)', async () => {
      const b = corpo({ title: 'Igual nos dois', pet_species: 'gato' });
      const norm = (j: Record<string, unknown>) => { const { id, qr_code, unique_code, created_at, updated_at, ...resto } = j as Record<string, unknown>; void id; void qr_code; void unique_code; void created_at; void updated_at; return resto; };
      const off = await (await post(userId, b)).json();
      process.env.COLABORADORES_ATIVO = '1';
      const on = await (await post(userId, { ...b, confirm_duplicate: true })).json();
      expect(norm(on)).toEqual(norm(off));
    });

    it('código vazio ou só espaços, com o interruptor ligado, equivale a não enviar código', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      for (const v of ['', '   ', null]) {
        const r = await post(userId, corpo({ colaborador_codigo: v }));
        expect(r.status, String(v)).toBe(201);
        expect((await linha((await r.json()).id)).colaborador_id).toBeNull();
      }
    });
  });

  describe('COM código (interruptor ligado)', () => {
    beforeEach(() => { process.env.COLABORADORES_ATIVO = '1'; });

    it('@nome, @nome com maiúsculas, código curto e código curto em minúsculas gravam a atribuição e o texto aceito', async () => {
      const casos: Array<[string, string]> = [['@backfindr', '@backfindr'], ['@BackFindr', '@backfindr'], ['ZL27', 'ZL27'], ['zl27', 'ZL27'], ['  backfindr ', '@backfindr']];
      for (const [digitado, esperado] of casos) {
        const r = await post(userId, corpo({ colaborador_codigo: digitado }));
        expect(r.status, digitado).toBe(201);
        const row = await linha((await r.json()).id);
        expect(row.colaborador_id, digitado).toBe(ids.backfindr);
        expect(row.colaborador_codigo, digitado).toBe(esperado);
      }
    });

    it('o código NUNCA entra em category_fields (nem a chave, nem o valor)', async () => {
      const r = await post(userId, corpo({ colaborador_codigo: 'ZL27', pet_species: 'cao' }));
      const row = await linha((await r.json()).id);
      expect(row.category_fields).toEqual({ pet_species: 'cao' });
      expect(JSON.stringify(row.category_fields)).not.toMatch(/colaborador|ZL27/i);
    });

    it('código inválido é recusado (400, CODIGO_COLABORADOR_INVALIDO) e NADA é criado', async () => {
      const antes = await total();
      for (const ruim of ['@naoexiste', 'XXXX', 'a', '<script>', '@', 'ZL27 ZL27', 12345, { a: 1 }, ['ZL27'], true]) {
        const r = await post(userId, corpo({ colaborador_codigo: ruim }));
        expect(r.status, JSON.stringify(ruim)).toBe(400);
        const j = await r.json();
        expect(j.error).toBe('CODIGO_COLABORADOR_INVALIDO');
        expect(j.detail).toMatch(/inválido ou inativo/);
      }
      expect(await total()).toBe(antes);
    });

    it('colaborador INATIVO (suspenso, saiu, excluído) é recusado, pelo @nome e pelo código curto, e nada é criado', async () => {
      const antes = await total();
      for (const c of ['@grupo-susp', 'SUSP', '@grupo-saiu', 'SAAU', '@grupo-excl', 'EXCL']) {
        const r = await post(userId, corpo({ colaborador_codigo: c }));
        expect(r.status, c).toBe(400);
        expect((await r.json()).error).toBe('CODIGO_COLABORADOR_INVALIDO');
      }
      expect(await total()).toBe(antes);
    });

    it('a mensagem de recusa é a mesma para código inexistente e para colaborador inativo (não confirma que o código existe)', async () => {
      const a = await (await post(userId, corpo({ colaborador_codigo: '@naoexiste' }))).json();
      const b = await (await post(userId, corpo({ colaborador_codigo: '@grupo-susp' }))).json();
      expect(b).toEqual(a);
    });

    it('o aviso de objeto parecido (409) continua funcionando e o reenvio confirmado leva o código', async () => {
      const b = corpo({ title: 'Carteira de identidade', description: 'Modelo novo Cin', category: 'document', colaborador_codigo: 'ZL27' });
      expect((await post(userId, b)).status).toBe(201);
      const dup = await post(userId, b);
      expect(dup.status).toBe(409);
      expect((await dup.json()).error).toBe('SIMILAR_OBJECT_FOUND');
      const ok = await post(userId, { ...b, confirm_duplicate: true });
      expect(ok.status).toBe(201);
      expect((await linha((await ok.json()).id)).colaborador_id).toBe(ids.backfindr);
    });

    it('código inválido é recusado ANTES do aviso de objeto parecido (nada é criado nem comparado)', async () => {
      const b = corpo({ title: 'Carteira de identidade', description: 'Modelo novo Cin', category: 'document' });
      expect((await post(userId, b)).status).toBe(201);
      const r = await post(userId, { ...b, colaborador_codigo: '@naoexiste' });
      expect(r.status).toBe(400);
    });
  });

  describe('interruptor DESLIGADO com código no corpo', () => {
    it('o valor é ignorado: cria sem atribuição e a chave não vai para category_fields', async () => {
      const r = await post(userId, corpo({ colaborador_codigo: 'ZL27', pet_species: 'cao' }));
      expect(r.status).toBe(201);
      const row = await linha((await r.json()).id);
      expect(row.colaborador_id).toBeNull();
      expect(row.colaborador_codigo).toBeNull();
      expect(row.category_fields).toEqual({ pet_species: 'cao' });
    });
    it('mesmo um código inválido não recusa nada (o programa está desligado)', async () => {
      expect((await post(userId, corpo({ colaborador_codigo: '@naoexiste' }))).status).toBe(201);
    });
  });

  describe('imutabilidade no banco', () => {
    let objId: string;
    beforeEach(async () => {
      process.env.COLABORADORES_ATIVO = '1';
      objId = (await (await post(userId, corpo({ colaborador_codigo: 'ZL27' }))).json()).id;
    });
    const tenta = (sql: string, params: unknown[] = []) => pool.query(sql, params);

    it('não troca o colaborador, não troca o texto, não apaga', async () => {
      await expect(tenta('UPDATE objects SET colaborador_id = $1 WHERE id = $2', [ids['grupo-susp'], objId])).rejects.toThrow(/não podem mudar/);
      await expect(tenta(`UPDATE objects SET colaborador_codigo = 'OUTRO' WHERE id = $1`, [objId])).rejects.toThrow(/não podem mudar/);
      await expect(tenta('UPDATE objects SET colaborador_id = NULL, colaborador_codigo = NULL WHERE id = $1', [objId])).rejects.toThrow(/não podem mudar/);
      const row = await linha(objId);
      expect(row.colaborador_id).toBe(ids.backfindr);
      expect(row.colaborador_codigo).toBe('ZL27');
    });

    it('uma ocorrência criada SEM código também não pode receber código depois (nulo → valor é recusado)', async () => {
      const semCodigo = (await (await post(userId, corpo())).json()).id;
      await expect(tenta('UPDATE objects SET colaborador_id = $1, colaborador_codigo = $2 WHERE id = $3', [ids.backfindr, 'ZL27', semCodigo])).rejects.toThrow(/não podem mudar/);
      expect((await linha(semCodigo)).colaborador_id).toBeNull();
    });

    it('os demais UPDATEs de objects continuam funcionando, inclusive regravar o mesmo valor', async () => {
      await tenta(`UPDATE objects SET title = 'Título novo', status = 'found' WHERE id = $1`, [objId]);
      await tenta('UPDATE objects SET colaborador_id = colaborador_id, colaborador_codigo = colaborador_codigo WHERE id = $1', [objId]);
      const row = await linha(objId);
      expect(row.title).toBe('Título novo');
      expect(row.colaborador_codigo).toBe('ZL27');
    });

    it('a linha de colaborador nunca é apagada (rastro), e com ocorrências a chave estrangeira também protege', async () => {
      await expect(tenta('DELETE FROM colaboradores WHERE id = $1', [ids.backfindr])).rejects.toThrow(/nunca é apagada/);
      await expect(tenta('DELETE FROM colaboradores WHERE id = $1', [ids['grupo-susp']])).rejects.toThrow(/nunca é apagada/);
    });

    it('o colaborador pode sair ou ser suspenso e o código registrado continua na ocorrência', async () => {
      await tenta(`UPDATE colaboradores SET estado = 'saiu' WHERE id = $1`, [ids.backfindr]);
      const row = await linha(objId);
      expect(row.colaborador_id).toBe(ids.backfindr);
      expect(row.colaborador_codigo).toBe('ZL27');
      process.env.COLABORADORES_ATIVO = '1';
      expect((await post(userId, corpo({ colaborador_codigo: 'ZL27' }))).status).toBe(400);   // novas ocorrências já não aceitam
    });
  });

  describe('migration 026', () => {
    it('é idempotente (rodar de novo não falha nem muda nada) e as linhas existentes ficam com as colunas nulas', async () => {
      await pool.query(MIGRATION);
      await pool.query(MIGRATION);
      const r = await pool.query(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'objects' AND column_name IN ('colaborador_id','colaborador_codigo') ORDER BY 1`);
      expect(r.rows).toEqual([{ column_name: 'colaborador_codigo', is_nullable: 'YES' }, { column_name: 'colaborador_id', is_nullable: 'YES' }]);
    });
    it('a reversão descrita no próprio arquivo funciona e deixa o objects como era', async () => {
      const rev = MIGRATION.split('\n').filter((l) => /^--   (DROP|ALTER)/.test(l)).map((l) => l.replace(/^--   /, '')).join('\n');
      expect(rev).toMatch(/DROP TABLE IF EXISTS colaboradores/);
      await pool.query(rev);
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'objects' AND column_name LIKE 'colaborador%'`);
      expect(cols.rows).toEqual([]);
      expect((await pool.query(`SELECT to_regclass('public.colaboradores') AS t`)).rows[0].t).toBeNull();
      await pool.query(MIGRATION);   // e reaplica sem problema
    });
    it('restrições da tabela: formato do @nome e do código, unicidade sem diferenciar maiúscula', async () => {
      const ins = (slug: string, curto: string) => pool.query(`INSERT INTO colaboradores (slug, codigo_curto, nome) VALUES ($1,$2,'X Y')`, [slug, curto]);
      await expect(ins('ab', 'QQQQ')).rejects.toThrow();            // curto demais
      await expect(ins('Maiuscula', 'QQQQ')).rejects.toThrow();      // maiúscula
      await expect(ins('-borda', 'QQQQ')).rejects.toThrow();
      await expect(ins('ok-slug', 'OOOO')).rejects.toThrow();        // O não existe no alfabeto
      await expect(ins('ok-slug', 'AB1D')).rejects.toThrow();        // 1 não existe no alfabeto
      await expect(ins('backfindr', 'QQQQ')).rejects.toThrow();      // slug repetido
      await expect(ins('outro-slug', 'zl27')).rejects.toThrow();     // formato (minúsculas) e também repetido
      await ins('ok-slug', 'QQQQ');
    });
  });

  describe('GET /api/v1/colaboradores/validar', () => {
    it('DESLIGADO: 404, como se a rota não existisse', async () => {
      const r = await validar('@backfindr');
      expect(r.status).toBe(404);
    });

    it('LIGADO: devolve só { ok, nome } para ativo, pelo @nome e pelo código curto', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      for (const c of ['@backfindr', 'backfindr', 'ZL27', 'zl27']) {
        const r = await validar(c);
        expect(r.status, c).toBe(200);
        expect(await r.json()).toEqual({ ok: true, nome: 'Backfindr' });
        expect(r.headers.get('cache-control')).toBe('no-store');
      }
    });

    it('LIGADO: inexistente, malformado e inativo dão a MESMA resposta', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      const resp = [];
      for (const c of ['@naoexiste', 'QQQQ', '<x>', '', '@grupo-susp', 'SUSP', '@grupo-excl', 'EXCL', '@grupo-saiu']) resp.push(await (await validar(c)).json());
      for (const j of resp) expect(j).toEqual({ ok: false });
    });

    it('LIGADO: limite de 30 pedidos por minuto por origem (429), sem afetar outra origem', async () => {
      process.env.COLABORADORES_ATIVO = '1';
      let ultimo = 200;
      for (let i = 0; i < 31; i++) ultimo = (await validar('@backfindr', '10.9.9.9')).status;
      expect(ultimo).toBe(429);
      expect((await validar('@backfindr', '10.8.8.8')).status).toBe(200);
    });
  });
});
