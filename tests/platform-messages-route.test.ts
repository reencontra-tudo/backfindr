// Rota POST /api/v1/admin/platform-messages com banco, guarda de admin e eventos SIMULADOS (sem banco real).
// Parte 1 (caracterização): comportamento de sempre, escrito ANTES de acrescentar o push opcional.
// Parte 2: push opcional e "urgente".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const db = vi.hoisted(() => ({
  target: { id: '2b7c1f0e-5d3a-4c1e-9a77-0c4f8e6d1a22', is_system: false, is_legacy: false } as Record<string, unknown> | null,
  insertRows: [{ id: 'n1', created_at: 'x' }] as unknown[],
  calls: [] as { sql: string; params: unknown[] }[],
  order: [] as string[],
  adminOk: true,
  prefRows: [] as unknown[],
  subs: [{ '?column?': 1 }] as unknown[],
  userRow: { is_system: false, is_legacy: false } as Record<string, unknown>,
}));
const sendPush = vi.hoisted(() => vi.fn());

vi.mock('@/lib/adminGuard', () => ({
  requireAdmin: async () =>
    db.adminOk ? { user: { id: 'admin-1', email: 'admin@teste.local', role: 'admin' } } : NextResponse.json({ detail: 'x' }, { status: 403 }),
}));
vi.mock('@/lib/jwt', () => ({ verifyToken: () => null, extractTokenFromHeader: () => null }));
vi.mock('@/lib/events', () => ({ recordEvent: vi.fn(async () => undefined) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: (...a: unknown[]) => sendPush(...a) }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    db.calls.push({ sql, params });
    if (sql.includes('FROM objects WHERE id')) return { rows: [{ user_id: db.target?.id }] };
    if (sql.includes('COALESCE(u.is_legacy')) return { rows: [db.userRow] };
    if (sql.includes('AS is_system')) return { rows: db.target ? [db.target] : [] };
    if (sql.startsWith('INSERT INTO notifications')) { db.order.push('insert'); return { rows: db.insertRows }; }
    if (sql.includes('FROM notification_preferences')) return { rows: db.prefRows };
    if (sql.includes('FROM push_subscriptions')) return { rows: db.subs };
    return { rows: [] };
  }),
}));

import { POST } from '@/app/api/v1/admin/platform-messages/route';

const UID = '2b7c1f0e-5d3a-4c1e-9a77-0c4f8e6d1a22';
const post = (body: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/v1/admin/platform-messages', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
const valid = (over: Record<string, unknown> = {}) => ({ user_id: UID, title: 'Olá', message: 'Adicione uma foto', ...over });
const insertCall = () => db.calls.find((c) => c.sql.startsWith('INSERT INTO notifications'));

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv';
  db.target = { id: UID, is_system: false, is_legacy: false };
  db.insertRows = [{ id: 'n1', created_at: 'x' }];
  db.calls = []; db.order = []; db.adminOk = true; db.prefRows = []; db.subs = [{ '?column?': 1 }];
  db.userRow = { is_system: false, is_legacy: false };
  sendPush.mockReset(); sendPush.mockImplementation(async () => { db.order.push('push'); });
});

describe('caracterização: comportamento de sempre (sem push)', () => {
  it('cria a mensagem: 201, { id, sent_by } e nada mais; texto escapado; link interno; data sem "urgent"', async () => {
    const res = await post(valid({ message: '<b>oi</b>', link: '/dashboard/objects/1' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'n1', sent_by: 'admin-1' });
    const c = insertCall()!;
    expect(c.params[0]).toBe(UID);
    expect(c.params[1]).toBe('platform_message');
    expect(c.params[3]).toBe('&lt;b&gt;oi&lt;/b&gt;');
    expect(c.params[4]).toBe('/dashboard/objects/1');
    const data = JSON.parse(c.params[5] as string);
    expect(Object.keys(data).sort()).toEqual(['object_id', 'sent_at', 'sent_by', 'sent_by_email']);
    expect(c.params[6]).toBe('admin-1');
    expect(c.sql).toContain("INTERVAL '24 hours'");
    expect(sendPush).not.toHaveBeenCalled();
  });
  it('link externo é recusado (400) e nada é gravado', async () => {
    const res = await post(valid({ link: 'https://x.com' }));
    expect(res.status).toBe(400);
    expect(insertCall()).toBeUndefined();
  });
  it('não admin: 403, nada gravado', async () => {
    db.adminOk = false;
    expect((await post(valid())).status).toBe(403);
    expect(insertCall()).toBeUndefined();
  });
  it('legado: 400 e nada gravado', async () => {
    db.target = { id: UID, is_system: false, is_legacy: true };
    expect((await post(valid())).status).toBe(400);
    expect(insertCall()).toBeUndefined();
  });
  it('conta de sistema: 400 e nada gravado', async () => {
    db.target = { id: UID, is_system: true, is_legacy: false };
    expect((await post(valid())).status).toBe(400);
    expect(insertCall()).toBeUndefined();
  });
  it('limite de 24 h (INSERT não devolve linha): 429', async () => {
    db.insertRows = [];
    const res = await post(valid());
    expect(res.status).toBe(429);
    expect((await res.json()).detail).toMatch(/24 horas/);
  });
});

describe('push opcional', () => {
  it('push ausente, false ou valor estranho: nenhum push e resposta idêntica à de sempre', async () => {
    for (const extra of [{}, { push: false }, { push: 'true' }, { push: 1 }, { urgent: true }]) {
      sendPush.mockClear();
      const res = await post(valid(extra));
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: 'n1', sent_by: 'admin-1' });
      expect(sendPush).not.toHaveBeenCalled();
    }
  });

  it('push + urgente: grava a mensagem ANTES, envia uma vez com texto fixo e evento platform_message; informa "push enviado"', async () => {
    const res = await post(valid({ push: true, urgent: true, title: 'SEGREDO-T', message: 'SEGREDO-M' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: 'n1', sent_by: 'admin-1', push: { requested: true, sent: true, label: 'push enviado' } });
    expect(db.order).toEqual(['insert', 'push']);
    expect(sendPush).toHaveBeenCalledTimes(1);
    const [uid, payload, opts] = sendPush.mock.calls[0];
    expect(uid).toBe(UID);
    expect(opts).toEqual({ event: 'platform_message' });
    expect(payload.title).toBe('Você tem uma mensagem da equipe do Backfindr');
    expect(payload.url).toBe('/dashboard/notifications');
    expect(JSON.stringify(payload)).not.toMatch(/SEGREDO/);
    const data = JSON.parse(insertCall()!.params[5] as string);
    expect(data.urgent).toBe(true);
  });

  it('push sem urgente: não grava "urgent"', async () => {
    await post(valid({ push: true }));
    expect('urgent' in JSON.parse(insertCall()!.params[5] as string)).toBe(false);
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('preferência do usuário desligada: não envia, mensagem criada, retorno informa', async () => {
    db.prefRows = [{ enabled: false }];
    const res = await post(valid({ push: true, urgent: true }));
    expect(res.status).toBe(201);
    expect((await res.json()).push).toMatchObject({ sent: false, label: 'usuário desligou esse aviso' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('usuário sem push ativo: não envia, mensagem criada', async () => {
    db.subs = [];
    const res = await post(valid({ push: true }));
    expect(res.status).toBe(201);
    expect((await res.json()).push).toMatchObject({ sent: false, label: 'usuário sem push ativo' });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('falha do envio: mensagem criada (201) e retorno informa o motivo', async () => {
    sendPush.mockRejectedValueOnce(new Error('boom'));
    const res = await post(valid({ push: true }));
    expect(res.status).toBe(201);
    const b = await res.json();
    expect(b.id).toBe('n1');
    expect(b.push).toMatchObject({ sent: false, label: 'push não enviado (falha técnica)' });
  });

  it('limite de 24 h vale também com push: 429 e nenhum push', async () => {
    db.insertRows = [];
    expect((await post(valid({ push: true, urgent: true }))).status).toBe(429);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('legado e conta de sistema continuam recusados com push pedido', async () => {
    db.target = { id: UID, is_system: false, is_legacy: true };
    expect((await post(valid({ push: true }))).status).toBe(400);
    db.target = { id: UID, is_system: true, is_legacy: false };
    expect((await post(valid({ push: true }))).status).toBe(400);
    expect(insertCall()).toBeUndefined();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('sem VAPID configurado: não finge que enviou', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const res = await post(valid({ push: true }));
    expect(res.status).toBe(201);
    expect((await res.json()).push.sent).toBe(false);
    expect(sendPush).not.toHaveBeenCalled();
  });
});
