// Testes de integração de POST /api/v1/admin/platform-messages.
// Usam um Postgres REAL. Sem TEST_DATABASE_URL a suíte é pulada.
//
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/backfindr_test \
//     npx vitest@2 run --config tests/vitest.config.ts
//
// ATENÇÃO: o schema de teste é recriado (DROP/CREATE de users, objects, notifications, object_events).
// Use banco descartável.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// Token de teste: "<user_id>" ou "<user_id>|<impersonated_by>".
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => {
    const [sub, imp] = t.split('|');
    return { sub, ...(imp ? { impersonated_by: imp } : {}) };
  },
}));

import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';

describe.skipIf(!TEST_DB)('POST /api/v1/admin/platform-messages', () => {
  let pool: Pool;
  let POST: (req: NextRequest) => Promise<Response>;
  let admin: string;
  let superAdmin: string;
  let owner: string;

  const mkUser = async (role = 'user', extra: { system?: boolean; id?: string } = {}) => {
    const id = extra.id ?? randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, name, role, is_system_account) VALUES ($1, $2, 'T', $3, $4)`,
      [id, `${id}@teste.local`, role, extra.system ?? false],
    );
    return id;
  };
  const mkObject = async (uid: string, legacy = false) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO objects (id, user_id, title, is_legacy) VALUES ($1, $2, 'Objeto', $3)`,
      [id, uid, legacy],
    );
    return id;
  };
  const send = (token: string, body: Record<string, unknown>) =>
    POST(
      new NextRequest('http://localhost/api/v1/admin/platform-messages', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const valid = (over: Record<string, unknown> = {}) => ({ user_id: owner, title: 'Olá', message: 'Adicione uma foto', ...over });
  const notifs = async (uid: string) =>
    (await pool.query(`SELECT * FROM notifications WHERE user_id = $1`, [uid])).rows;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS object_events, notifications, objects, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, email text, name text, plan text, role text,
      b2b_partner_id uuid, is_system_account boolean DEFAULT false)`);
    await pool.query(`CREATE TABLE objects (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text, is_legacy boolean DEFAULT false)`);
    await pool.query(`CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, title varchar NOT NULL, message text,
      type varchar, read boolean DEFAULT false, created_at timestamp DEFAULT now(), data jsonb, link text, url text)`);
    await pool.query(`CREATE TABLE object_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      object_id uuid NOT NULL REFERENCES objects(id) ON DELETE CASCADE, user_id uuid, type text NOT NULL, title text NOT NULL,
      description text, source text NOT NULL, actor_type text, actor_id uuid, metadata jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now())`);
    ({ POST } = await import('@/app/api/v1/admin/platform-messages/route'));
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE object_events, notifications, objects, users CASCADE');
    admin = await mkUser('admin');
    superAdmin = await mkUser('super_admin');
    owner = await mkUser('user');
  });

  afterAll(async () => { await pool?.end(); });

  it('admin cria a mensagem com sucesso (tipo, url e auditoria)', async () => {
    const res = await send(admin, valid({ link: '/dashboard/objects/abc' }));
    expect(res.status).toBe(201);
    const [n] = await notifs(owner);
    expect(n.type).toBe('platform_message');
    expect(n.url).toBe('/dashboard/objects/abc');
    expect(n.read).toBe(false);
    expect(n.data.sent_by).toBe(admin);
    expect(n.data.sent_at).toBeTruthy();
  });

  it('não admin recebe 403 e nada é gravado', async () => {
    const res = await send(owner, valid());
    expect(res.status).toBe(403);
    expect(await notifs(owner)).toHaveLength(0);
  });

  it.each(['https://evil.com', '//evil.com', 'javascript:alert(1)', '/ok\\evil', 'dashboard/x'])(
    'rejeita link não interno: %s', async (link) => {
      const res = await send(admin, valid({ link }));
      expect(res.status).toBe(400);
      expect(await notifs(owner)).toHaveLength(0);
    },
  );

  it('exige título e texto e respeita os limites', async () => {
    expect((await send(admin, valid({ title: '  ' }))).status).toBe(400);
    expect((await send(admin, valid({ message: '' }))).status).toBe(400);
    expect((await send(admin, valid({ title: 'x'.repeat(81) }))).status).toBe(400);
    expect((await send(admin, valid({ message: 'x'.repeat(501) }))).status).toBe(400);
  });

  it('recusa destinatário legado', async () => {
    await mkObject(owner, true);
    const res = await send(admin, valid());
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toMatch(/legado/i);
    expect(await notifs(owner)).toHaveLength(0);
  });

  it('recusa a conta de sistema', async () => {
    await mkUser('user', { system: true, id: SYSTEM_ACCOUNT_ID });
    const res = await send(admin, valid({ user_id: SYSTEM_ACCOUNT_ID }));
    expect(res.status).toBe(400);
    expect(await notifs(SYSTEM_ACCOUNT_ID)).toHaveLength(0);
  });

  it('segundo envio do mesmo admin ao mesmo usuário em 24h retorna 429', async () => {
    expect((await send(admin, valid())).status).toBe(201);
    expect((await send(admin, valid({ title: 'Outra' }))).status).toBe(429);
    expect(await notifs(owner)).toHaveLength(1);
    // outro admin não é limitado pelo primeiro
    expect((await send(superAdmin, valid())).status).toBe(201);
    // passadas 24h, libera
    await pool.query(`UPDATE notifications SET created_at = NOW() - INTERVAL '25 hours' WHERE data->>'sent_by' = $1`, [admin]);
    expect((await send(admin, valid())).status).toBe(201);
  });

  it('texto com HTML sai escapado', async () => {
    const res = await send(admin, valid({ title: '<b>oi</b>', message: '<script>alert("x")</script> & mais' }));
    expect(res.status).toBe(201);
    const [n] = await notifs(owner);
    expect(n.title).toBe('&lt;b&gt;oi&lt;/b&gt;');
    expect(n.message).not.toContain('<');
    expect(n.message).toContain('&lt;script&gt;');
    expect(n.message).toContain('&amp; mais');
  });

  it('com object_id, envia ao dono do objeto e grava evento de auditoria', async () => {
    const oid = await mkObject(owner);
    const res = await send(admin, { object_id: oid, title: 'T', message: 'M', link: `/dashboard/objects/${oid}` });
    expect(res.status).toBe(201);
    expect(await notifs(owner)).toHaveLength(1);
    const ev = (await pool.query(`SELECT * FROM object_events WHERE object_id = $1`, [oid])).rows;
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe('platform_message_sent');
    expect(ev[0].actor_id).toBe(admin);
  });

  it('impersonation: registra o admin real, nunca o usuário impersonado', async () => {
    // O token é do usuário impersonado (sub) com impersonated_by = super_admin real.
    // Se o impersonado for admin, passa pelo guard, mas o remetente gravado é o super_admin.
    const target = await mkUser('admin');
    const res = await send(`${target}|${superAdmin}`, valid());
    expect(res.status).toBe(201);
    const [n] = await notifs(owner);
    expect(n.data.sent_by).toBe(superAdmin);
    expect(n.data.via_impersonation_of).toBe(target);
  });

  it('impersonation: sessão em nome de usuário comum não envia (403)', async () => {
    const res = await send(`${owner}|${superAdmin}`, valid());
    expect(res.status).toBe(403);
  });

  it('impersonation: impersonated_by que não é admin é recusado', async () => {
    const target = await mkUser('admin');
    const res = await send(`${target}|${owner}`, valid());
    expect(res.status).toBe(403);
    expect(await notifs(owner)).toHaveLength(0);
  });
});
