// Caracterização dos dois endpoints públicos de aviso por QR:
//   POST /api/v1/objects/scan/[code]/notify  (o que a interface chama)
//   POST /api/v1/objects/scan/[code]         (nenhum cliente do repositório chama)
// Sem banco: db, push, e-mail e eventos são simulados; o que se confere é o que cada rota grava e envia.
//
//   npx vitest@2 run --config tests/vitest.config.ts tests/scan-endpoints.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  object: null as null | Record<string, unknown>,
  lastOwnerNotifiedMinutesAgo: null as null | number,
  ownerEmail: 'dono@teste.local' as string | null,
  notifications: [] as unknown[][],
  updates: [] as string[],
  queries: [] as string[],
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    state.queries.push(sql);
    if (sql.includes('FROM objects o LEFT JOIN users u')) {
      return { rows: state.object ? [state.object] : [] };
    }
    if (sql.includes('FROM object_events')) {
      return {
        rows:
          state.lastOwnerNotifiedMinutesAgo === null
            ? []
            : [{ created_at: new Date(Date.now() - state.lastOwnerNotifiedMinutesAgo * 60000).toISOString() }],
      };
    }
    if (sql.includes('SELECT id, title FROM objects')) {
      return { rows: state.object ? [{ id: state.object.id, title: state.object.title }] : [] };
    }
    if (sql.includes('INSERT INTO notifications')) {
      state.notifications.push(params);
      return { rows: [] };
    }
    if (sql.includes('UPDATE objects SET found_pending_confirmation')) {
      state.updates.push(sql);
      return { rows: [] };
    }
    if (sql.includes('SELECT name, email FROM users')) {
      return { rows: state.ownerEmail ? [{ name: 'Dono', email: state.ownerEmail }] : [{ name: 'Dono', email: null }] };
    }
    return { rows: [] };
  }),
}));
vi.mock('@/lib/pushNotification', () => ({
  sendPushToUser: vi.fn(async () => undefined),
  scanPayload: vi.fn((title: string, id: string) => ({ title, id })),
}));
vi.mock('@/lib/email', () => ({ sendObjectFoundEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/events', () => ({
  Events: { qrScanned: vi.fn(async () => undefined) },
  recordEvent: vi.fn(async () => undefined),
}));
vi.mock('@/lib/awaitSends', () => ({
  awaitSends: vi.fn(async (tasks: Array<Promise<unknown>>) => { await Promise.allSettled(tasks); }),
}));

import { sendPushToUser } from '@/lib/pushNotification';
import { sendObjectFoundEmail } from '@/lib/email';
import { POST as postBare } from '@/app/api/v1/objects/scan/[code]/route';
import { POST as postNotify } from '@/app/api/v1/objects/scan/[code]/notify/route';

const obj = (over: Record<string, unknown> = {}) => ({
  id: 'obj-1', user_id: 'user-1', title: 'Mochila azul', status: 'lost', category: 'bag', legacy_blocked: false, ...over,
});

function call(handler: typeof postBare, body: unknown = {}) {
  const req = new NextRequest('https://app.teste.local/api/v1/objects/scan/ABC', { method: 'POST', body: JSON.stringify(body) });
  return handler(req, { params: { code: 'ABC' } });
}

beforeEach(() => {
  state.object = obj();
  state.lastOwnerNotifiedMinutesAgo = null;
  state.ownerEmail = 'dono@teste.local';
  state.notifications = [];
  state.updates = [];
  state.queries = [];
  vi.mocked(sendPushToUser).mockClear();
  vi.mocked(sendObjectFoundEmail).mockClear();
});

describe('/notify (usado pela interface) — comportamento que não pode mudar', () => {
  it('objeto perdido: grava aviso com url, marca pendência, envia push e e-mail', async () => {
    const res = await call(postNotify);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Owner notified successfully' });
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0][3]).toBe('scan');
    expect(state.notifications[0][4]).toBe('/dashboard/objects/obj-1');
    expect(String(state.notifications[0][1])).toContain('Alguém sinalizou');
    expect(state.updates).toHaveLength(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendObjectFoundEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendObjectFoundEmail).mock.calls[0][1]).toMatchObject({ isProtected: false });
  });

  it('objeto protegido: texto de QR escaneado e e-mail com isProtected', async () => {
    state.object = obj({ status: 'protected' });
    await call(postNotify);
    expect(String(state.notifications[0][1])).toContain('QR Code escaneado');
    expect(vi.mocked(sendObjectFoundEmail).mock.calls[0][1]).toMatchObject({ isProtected: true });
  });

  it('objeto legado: aviso no app como antes, mas nenhum push nem e-mail; mesma resposta', async () => {
    state.object = obj({ legacy_blocked: true });
    const res = await call(postNotify);
    expect(await res.json()).toEqual({ message: 'Owner notified successfully' });
    expect(state.notifications).toHaveLength(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(sendObjectFoundEmail).not.toHaveBeenCalled();
  });

  it('cooldown de 15 min: 5 min depois não repete nada; 16 min depois avisa de novo', async () => {
    state.lastOwnerNotifiedMinutesAgo = 5;
    const dentro = await call(postNotify);
    expect(await dentro.json()).toEqual({ message: 'Owner already notified recently' });
    expect(state.notifications).toHaveLength(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(sendObjectFoundEmail).not.toHaveBeenCalled();

    state.lastOwnerNotifiedMinutesAgo = 16;
    const fora = await call(postNotify);
    expect(await fora.json()).toEqual({ message: 'Owner notified successfully' });
    expect(state.notifications).toHaveLength(1);
  });

  it('dono sem e-mail: push sai, e-mail não, resposta normal', async () => {
    state.ownerEmail = null;
    const res = await call(postNotify);
    expect(res.status).toBe(200);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendObjectFoundEmail).not.toHaveBeenCalled();
  });

  it('objeto inexistente: 404', async () => {
    state.object = null;
    expect((await call(postNotify)).status).toBe(404);
  });
});

// Estado ATUAL do endpoint sem /notify (antes da unificação).
describe('POST /scan/[code] (sem /notify) — estado atual', () => {
  it('grava aviso próprio (type qr_scan, sem url), usa a mensagem do corpo, só push, sem e-mail, sem cooldown', async () => {
    state.lastOwnerNotifiedMinutesAgo = 1;
    const res = await call(postBare, { message: 'texto livre' });
    expect(await res.json()).toEqual({ message: 'Notification sent' });
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toEqual(['user-1', 'QR Code Escaneado', 'texto livre', 'qr_scan']);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendObjectFoundEmail).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
  });

  it('objeto legado: aviso no app, sem push; mesma resposta', async () => {
    state.object = obj({ legacy_blocked: true });
    const res = await call(postBare);
    expect(await res.json()).toEqual({ message: 'Notification sent' });
    expect(state.notifications).toHaveLength(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('objeto inexistente: 404', async () => {
    state.object = null;
    expect((await call(postBare)).status).toBe(404);
  });
});
