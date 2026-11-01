// Preferências de aviso (migration 023): sem linha gravada o push sai como sempre; com push desligado
// para um evento, esse evento não sai; sem a tabela, tudo continua ligado; sem `event`, nada é consultado.
// Sem banco: db e web-push são simulados.
//
//   npx vitest@2 run --config tests/vitest.config.ts tests/notification-preferences.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'pub-teste';
  process.env.VAPID_PRIVATE_KEY = 'priv-teste';
});

const db = vi.hoisted(() => ({
  prefRows: [] as Array<Record<string, unknown>>,
  prefTableMissing: false,
  prefQueries: 0,
  writes: [] as unknown[][],
}));

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => undefined) },
}));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM push_subscriptions')) {
      return { rows: [{ id: 's1', user_id: 'u1', endpoint: 'https://push.teste/1', auth: 'a', p256dh: 'p' }] };
    }
    if (sql.includes('notification_preferences')) {
      if (db.prefTableMissing) throw new Error('relation "notification_preferences" does not exist');
      if (sql.startsWith('INSERT')) { db.writes.push(params); return { rows: [] }; }
      db.prefQueries++;
      return { rows: db.prefRows };
    }
    return { rows: [] };
  }),
}));
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => h,
  verifyToken: (t: string) => (t === 'valido' ? { sub: 'u1' } : null),
}));

import webpush from 'web-push';
import { sendPushToUser } from '@/lib/pushNotification';
import { GET, PUT } from '@/app/api/v1/notifications/preferences/route';

const payload = { title: 't', body: 'b' };
const sent = () => vi.mocked(webpush.sendNotification).mock.calls.length;

beforeEach(() => {
  db.prefRows = [];
  db.prefTableMissing = false;
  db.prefQueries = 0;
  db.writes = [];
  vi.mocked(webpush.sendNotification).mockClear();
});

describe('push respeita a preferência', () => {
  it('usuário sem preferência gravada: sai, em todos os eventos', async () => {
    for (const event of ['match', 'qr_scan', 'chat_message', 'returned'] as const) {
      await sendPushToUser('u1', payload, { event });
    }
    expect(sent()).toBe(4);
  });

  it('usuário que desligou push de chat: chat não sai, QR escaneado continua saindo', async () => {
    db.prefRows = [{ enabled: false }];
    await sendPushToUser('u1', payload, { event: 'chat_message' });
    expect(sent()).toBe(0);
    db.prefRows = [];
    await sendPushToUser('u1', payload, { event: 'qr_scan' });
    expect(sent()).toBe(1);
  });

  it('tabela inexistente: tudo ligado, sem erro', async () => {
    db.prefTableMissing = true;
    await expect(sendPushToUser('u1', payload, { event: 'chat_message' })).resolves.toBeUndefined();
    expect(sent()).toBe(1);
  });

  it('sem `event` (chamadores que não mudaram): preferência nem é consultada e o push sai', async () => {
    db.prefRows = [{ enabled: false }];
    await sendPushToUser('u1', payload);
    expect(db.prefQueries).toBe(0);
    expect(sent()).toBe(1);
  });
});

const req = (method: string, body?: unknown, auth: string | null = 'valido') =>
  new NextRequest('https://app.teste.local/api/v1/notifications/preferences', {
    method,
    headers: auth ? { authorization: auth } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('API de preferências', () => {
  it('sem login: 401', async () => {
    expect((await GET(req('GET', undefined, null))).status).toBe(401);
    expect((await PUT(req('PUT', { event: 'match', channel: 'push', enabled: false }, 'invalido'))).status).toBe(401);
  });

  it('GET sem tabela: tudo ligado', async () => {
    db.prefTableMissing = true;
    const body = await (await GET(req('GET'))).json();
    for (const e of ['match', 'qr_scan', 'chat_message', 'returned']) expect(body.preferences[e].push).toBe(true);
  });

  it('GET reflete o que o usuário desligou', async () => {
    db.prefRows = [{ event: 'chat_message', channel: 'push', enabled: false }];
    const body = await (await GET(req('GET'))).json();
    expect(body.preferences.chat_message.push).toBe(false);
    expect(body.preferences.match.push).toBe(true);
  });

  it('PUT grava a preferência válida', async () => {
    const res = await PUT(req('PUT', { event: 'chat_message', channel: 'push', enabled: false }));
    expect(res.status).toBe(200);
    expect(db.writes).toEqual([['u1', 'chat_message', 'push', false]]);
  });

  it('e-mail de segurança não é desligável: evento de segurança e canal de e-mail são recusados', async () => {
    expect((await PUT(req('PUT', { event: 'security', channel: 'email', enabled: false }))).status).toBe(400);
    expect((await PUT(req('PUT', { event: 'match', channel: 'email', enabled: false }))).status).toBe(400);
    expect((await PUT(req('PUT', { event: 'match', channel: 'push', enabled: 'nao' }))).status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });

  it('PUT sem a tabela: 503, sem derrubar nada', async () => {
    db.prefTableMissing = true;
    expect((await PUT(req('PUT', { event: 'match', channel: 'push', enabled: false }))).status).toBe(503);
  });
});
