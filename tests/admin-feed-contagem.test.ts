// Contagem do admin × Feed, com Postgres REAL (só com TEST_DATABASE_URL): o número do admin tem de ser o mesmo que o Feed pode listar.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest run --config tests/vitest.config.ts tests/admin-feed-contagem.test.ts
// ATENÇÃO: recria as tabelas do banco de teste (tests/fixtures/feed-schema.sql). Use banco descartável.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

describe.skipIf(!TEST_DB)('contagem do admin × Feed (banco real)', () => {
  let pool: Pool;
  let stats: typeof import('@/lib/feed/stats');
  let q: typeof import('@/lib/feed/query');
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    stats = await import('@/lib/feed/stats'); q = await import('@/lib/feed/query');
  });
  afterAll(async () => { await pool.end(); });

  it('o total do admin é igual ao número de linhas que a consulta do Feed lê (mesma regra), e a divisão por origem e status bate linha a linha', async () => {
    const feed = await pool.query(q.FEED_SQL, [q.FEED_MAX_CANDIDATES + 1]);
    const c = await stats.countFeedEligible();
    expect(c.total).toBe(feed.rows.length);
    const esperado = { usuarios: { total: 0, lost: 0, found: 0, stolen: 0 }, sinais: { total: 0, lost: 0, found: 0, stolen: 0 } } as Record<string, Record<string, number>>;
    for (const r of feed.rows) { const g = r.source === 'public_signal' ? 'sinais' : 'usuarios'; esperado[g][r.status]++; esperado[g].total++; }
    expect(c.usuarios).toEqual(esperado.usuarios); expect(c.sinais_publicos).toEqual(esperado.sinais);
    expect(c.total).toBeGreaterThan(0);
  });
  it('quem o Feed não mostra também não entra na contagem: privado, legado, status fora de lost/found/stolen e sem código', async () => {
    const antes = (await stats.countFeedEligible()).total;
    const base = (await pool.query(`SELECT * FROM objects WHERE is_public = true AND is_legacy = false AND status IN ('lost','found','stolen') AND qr_code IS NOT NULL LIMIT 1`)).rows[0];
    expect(base).toBeTruthy();
    const clone = async (patch: string) => { // cópia do objeto com UM campo alterado, para ver se entra ou não
      const cols = Object.keys(base).filter((k) => k !== 'id');
      const id = (await pool.query(`INSERT INTO objects (${cols.map((c) => `"${c}"`).join(',')}) SELECT ${cols.map((c) => `"${c}"`).join(',')} FROM objects WHERE id = $1 RETURNING id`, [base.id])).rows[0].id;
      await pool.query(`UPDATE objects SET ${patch} WHERE id = $1`, [id]); return id;
    };
    const ids: string[] = [];
    try {
      ids.push(await clone(`is_public = false, qr_code = 'TESTE-PRIV-1'`));
      ids.push(await clone(`is_legacy = true, qr_code = 'TESTE-LEG-1'`));
      ids.push(await clone(`status = 'returned', qr_code = 'TESTE-RET-1'`));
      ids.push(await clone(`qr_code = NULL`));
      expect((await stats.countFeedEligible()).total).toBe(antes);
      ids.push(await clone(`qr_code = 'TESTE-OK-1'`));                    // este é elegível: sobe 1
      expect((await stats.countFeedEligible()).total).toBe(antes + 1);
      const feed = await pool.query(q.FEED_SQL, [q.FEED_MAX_CANDIDATES + 1]);
      expect(feed.rows.length).toBe(antes + 1);                           // e o Feed concorda
    } finally { if (ids.length) await pool.query('DELETE FROM objects WHERE id = ANY($1::uuid[])', [ids]); }
  });
  it('não escreve nada: contar não altera o banco', async () => {
    const a = (await pool.query('SELECT count(*)::int n FROM objects')).rows[0].n;
    await stats.countFeedEligible(); await stats.countFeedEligible();
    expect((await pool.query('SELECT count(*)::int n FROM objects')).rows[0].n).toBe(a);
  });
});
