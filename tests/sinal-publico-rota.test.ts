// Trava no servidor: aviso ao «dono» de SINAL PÚBLICO é recusado sem gravar nada. Usuário e legado: igual a antes.
// (Sem banco: db, push, e-mail e eventos simulados; o que se confere é o que cada rota grava e envia.)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

const state = vi.hoisted(() => ({
  object: null as null | Record<string, unknown>,
  writes: [] as string[], notifications: [] as unknown[][], updates: [] as string[], queries: [] as string[],
}));
const events = vi.hoisted(() => ({ qrScanned: vi.fn(async () => undefined), recordEvent: vi.fn(async () => undefined) }));

vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    state.queries.push(sql);
    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) state.writes.push(sql);
    if (sql.includes('FROM objects o LEFT JOIN users u')) return { rows: state.object ? [state.object] : [] };
    if (sql.includes('FROM object_events')) return { rows: [] };
    if (sql.includes('INSERT INTO notifications')) { state.notifications.push(params); return { rows: [] }; }
    if (sql.includes('UPDATE objects SET found_pending_confirmation')) { state.updates.push(sql); return { rows: [] }; }
    if (sql.includes('SELECT name, email FROM users')) return { rows: [{ name: 'Dono', email: 'dono@teste.local' }] };
    return { rows: [] };
  }),
}));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async () => undefined), scanPayload: vi.fn((t: string, id: string) => ({ t, id })) }));
vi.mock('@/lib/email', () => ({ sendObjectFoundEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/events', () => ({ Events: { qrScanned: events.qrScanned }, recordEvent: events.recordEvent }));
vi.mock('@/lib/awaitSends', () => ({ awaitSends: vi.fn(async (t: Array<Promise<unknown>>) => { await Promise.allSettled(t); }) }));

import { sendPushToUser } from '@/lib/pushNotification';
import { sendObjectFoundEmail } from '@/lib/email';
import { POST as postBare } from '@/app/api/v1/objects/scan/[code]/route';
import { POST as postNotify } from '@/app/api/v1/objects/scan/[code]/notify/route';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const obj = (over: Record<string, unknown> = {}) => ({ id: 'obj-1', user_id: 'sistema-1', title: 'Documento encontrado', status: 'found', category: 'document', source: 'public_signal', legacy_blocked: false, ...over });
const call = (h: typeof postBare) => h(new NextRequest('https://app.teste.local/api/v1/objects/scan/ABC', { method: 'POST', body: '{}' }), { params: { code: 'ABC' } });
const nadaGravado = () => {
  expect(state.writes).toEqual([]); expect(state.notifications).toHaveLength(0); expect(state.updates).toHaveLength(0);
  expect(sendPushToUser).not.toHaveBeenCalled(); expect(sendObjectFoundEmail).not.toHaveBeenCalled();
  expect(events.qrScanned).not.toHaveBeenCalled(); expect(events.recordEvent).not.toHaveBeenCalled();
};

beforeEach(() => {
  state.object = obj(); state.writes = []; state.notifications = []; state.updates = []; state.queries = [];
  vi.mocked(sendPushToUser).mockClear(); vi.mocked(sendObjectFoundEmail).mockClear(); events.qrScanned.mockClear(); events.recordEvent.mockClear();
});

describe('sinal público: o aviso é recusado e NADA é gravado', () => {
  for (const status of ['found', 'lost', 'stolen', 'protected']) {
    it(`/notify com sinal «${status}»: 409 com mensagem amigável; sem notificação, e-mail, push, eventos nem «achado pendente»`, async () => {
      state.object = obj({ status });
      const res = await call(postNotify);
      expect(res.status).toBe(409);
      const j = await res.json();
      expect(j.detail).toBe('Este registro foi extraído de uma notícia pública e não tem dono cadastrado no Backfindr. Para tentar contato, procure a fonte original.');
      expect(j.detail).not.toMatch(/protegid|SMS|responder|notificad/i);
      nadaGravado();
    });
  }
  it('a rota «sem /notify» (alias) também recusa, com a mesma mensagem, sem gravar nada', async () => {
    const res = await call(postBare);
    expect(res.status).toBe(409); expect((await res.json()).detail).toContain('não tem dono cadastrado'); nadaGravado();
  });
  it('mesmo repetindo (cooldown não entra): continua recusando e sem gravar', async () => {
    await call(postNotify); await call(postNotify); nadaGravado();
  });
  it('a recusa vem ANTES de qualquer escrita: nenhuma consulta de gravação foi feita', async () => {
    await call(postNotify);
    expect(state.queries.some((s) => /INSERT|UPDATE/i.test(s))).toBe(false);
    expect(state.queries.some((s) => s.includes('FROM object_events'))).toBe(false);   // nem chegou ao cooldown
  });
  it('sinal público de dono «legado» (flag) também é recusado (nada a avisar)', async () => {
    state.object = obj({ legacy_blocked: true }); expect((await call(postNotify)).status).toBe(409); nadaGravado();
  });
});

describe('objeto de usuário e do legado: comportamento IDÊNTICO ao de hoje', () => {
  it('usuário perdido: 200, grava aviso com url, marca pendência, push e e-mail', async () => {
    state.object = obj({ source: null, user_id: 'user-1', status: 'lost', title: 'Mochila azul', category: 'bag' });
    const res = await call(postNotify);
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ message: 'Owner notified successfully' });
    expect(state.notifications).toHaveLength(1); expect(state.notifications[0][4]).toBe('/dashboard/objects/obj-1');
    expect(state.updates).toHaveLength(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1); expect(sendObjectFoundEmail).toHaveBeenCalledTimes(1);
    expect(events.recordEvent).toHaveBeenCalledTimes(1);
  });
  it('usuário com source «user» e a rota «sem /notify»: 200 «Notification sent»', async () => {
    state.object = obj({ source: 'user', user_id: 'user-1', status: 'lost' });
    const res = await call(postBare); expect(res.status).toBe(200); expect(await res.json()).toEqual({ message: 'Notification sent' }); expect(state.notifications).toHaveLength(1);
  });
  it('legado: aviso no app como antes, nenhum push nem e-mail, mesma resposta', async () => {
    state.object = obj({ source: 'webjetos', user_id: 'user-1', status: 'lost', legacy_blocked: true });
    const res = await call(postNotify);
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ message: 'Owner notified successfully' });
    expect(state.notifications).toHaveLength(1); expect(sendPushToUser).not.toHaveBeenCalled(); expect(sendObjectFoundEmail).not.toHaveBeenCalled();
  });
  it('objeto inexistente: 404 como sempre', async () => { state.object = null; expect((await call(postNotify)).status).toBe(404); });
});

describe('no código', () => {
  it('o critério é o mesmo (source === public_signal) e a recusa está antes do cooldown e das gravações', () => {
    const r = read('src/app/api/v1/objects/scan/[code]/notify/route.ts');
    const trava = r.indexOf("object.source === 'public_signal'");
    expect(trava).toBeGreaterThan(0);
    for (const depois of ['FROM object_events', 'INSERT INTO notifications', 'UPDATE objects SET found_pending_confirmation', 'Events.qrScanned', 'recordEvent({']) expect(r.indexOf(depois), depois).toBeGreaterThan(trava);
  });
});
