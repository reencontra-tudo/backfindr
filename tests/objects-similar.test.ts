// Testes de integração do aviso de objeto parecido em POST /api/v1/objects.
// Usam um Postgres REAL (precisa de pg_trgm). Sem TEST_DATABASE_URL a suíte é pulada.
//
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/backfindr_test \
//     npx vitest@2 run --config tests/vitest.config.ts
//
// ATENÇÃO: o schema de teste é recriado (DROP/CREATE de users e objects). Use banco descartável.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// O token de teste é o próprio user_id.
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => ({ sub: t }),
}));
vi.mock('@/lib/events', () => {
  const noop = () => Promise.resolve();
  return { Events: { objectCreated: noop, objectPublished: noop, objectIndexed: noop, qrGenerated: noop } };
});
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));

import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';

describe.skipIf(!TEST_DB)('POST /api/v1/objects — aviso de objeto parecido', () => {
  let pool: Pool;
  let POST: (req: NextRequest) => Promise<Response>;
  let userId: string;

  const countObjects = async (uid: string) =>
    Number((await pool.query('SELECT COUNT(*) FROM objects WHERE user_id = $1', [uid])).rows[0].count);

  const seed = async (uid: string, o: { title: string; description?: string | null; category?: string; status?: string }) => {
    await pool.query(
      `INSERT INTO objects (user_id, title, description, status, category, type, qr_code)
       VALUES ($1, $2, $3, $4, $5, $5, $6)`,
      [uid, o.title, o.description ?? null, o.status ?? 'lost', o.category ?? 'document', randomUUID().slice(0, 8)],
    );
  };

  const post = (uid: string, body: Record<string, unknown>) =>
    POST(
      new NextRequest('http://localhost/api/v1/objects', {
        method: 'POST',
        headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  const newBody = (over: Record<string, unknown> = {}) => ({
    title: 'Carteira de identidade',
    description: 'Modelo novo Cin',
    category: 'document',
    status: 'lost',
    ...over,
  });

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await pool.query('DROP TABLE IF EXISTS objects, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, plan text, plan_expires_at timestamptz)`);
    await pool.query(`CREATE TABLE objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar NOT NULL, description text, status varchar DEFAULT 'lost',
      type varchar NOT NULL, location varchar, latitude numeric, longitude numeric,
      qr_code varchar NOT NULL UNIQUE, images jsonb DEFAULT '[]', created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(), category varchar, is_public boolean DEFAULT true,
      reward_amount numeric, reward_description text, category_fields jsonb DEFAULT '{}')`);
    await pool.query('CREATE INDEX idx_objects_user_id ON objects (user_id)');
    await pool.query('CREATE INDEX idx_objects_title_trgm ON objects USING gin (title gin_trgm_ops)');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    ({ POST } = await import('@/app/api/v1/objects/route'));
  });

  beforeEach(async () => {
    userId = randomUUID();
    // plano business: não esbarra no limite de 3 objetos do plano free
    await pool.query(`INSERT INTO users (id, plan) VALUES ($1, 'business')`, [userId]);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool?.end();
  });

  it('(a) objeto novo sem parecido -> 201', async () => {
    await seed(userId, { title: 'Mochila azul', description: 'Mochila escolar com chaveiro', category: 'bag' });
    const res = await post(userId, newBody());
    expect(res.status).toBe(201);
    expect(await countObjects(userId)).toBe(2);
  });

  it('(b) mesma descrição + mesma categoria -> 409 e nada é inserido', async () => {
    await seed(userId, { title: 'RG', description: '  MODELO novo cin ' });
    const res = await post(userId, newBody({ title: 'Documento qualquer' }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('SIMILAR_OBJECT_FOUND');
    expect(data.similar_objects).toHaveLength(1);
    expect(Object.keys(data.similar_objects[0]).sort()).toEqual(['created_at', 'description', 'id', 'status', 'title']);
    expect(await countObjects(userId)).toBe(1);
  });

  it('(c) título parecido (caso real: indentidade/identidade) -> 409', async () => {
    await seed(userId, { title: 'Carteira de indentidade', description: 'texto totalmente diferente aqui' });
    const res = await post(userId, newBody());
    expect(res.status).toBe(409);
    expect((await res.json()).similar_objects[0].title).toBe('Carteira de indentidade');
    expect(await countObjects(userId)).toBe(1);
  });

  it('(d) confirm_duplicate: true cria normalmente e não grava a flag', async () => {
    await seed(userId, { title: 'Carteira de identidade', description: 'Modelo novo Cin' });
    const res = await post(userId, newBody({ confirm_duplicate: true }));
    expect(res.status).toBe(201);
    expect(await countObjects(userId)).toBe(2);
    const row = (await pool.query('SELECT category_fields FROM objects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])).rows[0];
    expect(row.category_fields).not.toHaveProperty('confirm_duplicate');
  });

  it('(e) objeto parecido de OUTRO usuário não dispara aviso', async () => {
    const other = randomUUID();
    await pool.query(`INSERT INTO users (id, plan) VALUES ($1, 'business')`, [other]);
    await seed(other, { title: 'Carteira de identidade', description: 'Modelo novo Cin' });
    const res = await post(userId, newBody());
    expect(res.status).toBe(201);
  });

  it('(f) categoria diferente não dispara aviso', async () => {
    await seed(userId, { title: 'Carteira de identidade', description: 'Modelo novo Cin', category: 'wallet' });
    const res = await post(userId, newBody());
    expect(res.status).toBe(201);
  });

  it('retorna no máximo 3 objetos parecidos, do mais recente ao mais antigo', async () => {
    for (let i = 0; i < 5; i++) await seed(userId, { title: `Item ${i}`, description: 'Modelo novo Cin' });
    const res = await post(userId, newBody({ title: 'Outro título' }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.similar_objects).toHaveLength(3);
    expect(data.similar_objects[0].title).toBe('Item 4');
  });

  it('objeto apagado (status deleted) não conta como parecido', async () => {
    await seed(userId, { title: 'Carteira de identidade', description: 'Modelo novo Cin', status: 'deleted' });
    expect((await post(userId, newBody())).status).toBe(201);
  });

  it('descrição vazia não casa com descrição vazia; títulos distintos -> 201', async () => {
    await seed(userId, { title: 'Guarda-chuva preto', description: '   ' });
    const res = await post(userId, newBody({ title: 'Carteira de identidade', description: '' }));
    expect(res.status).toBe(201);
  });

  it('conta de sistema não passa pela checagem', async () => {
    await pool.query(`INSERT INTO users (id, plan) VALUES ($1, 'business')`, [SYSTEM_ACCOUNT_ID]);
    await seed(SYSTEM_ACCOUNT_ID, { title: 'Carteira de identidade', description: 'Modelo novo Cin' });
    expect((await post(SYSTEM_ACCOUNT_ID, newBody())).status).toBe(201);
    await pool.query('DELETE FROM users WHERE id = $1', [SYSTEM_ACCOUNT_ID]);
  });
});
