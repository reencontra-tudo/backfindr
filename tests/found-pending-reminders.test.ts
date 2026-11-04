// Rota /api/v1/cron/found-pending-reminders: D+3, D+7 e D+14 caracterizados (não podem mudar) e o novo D+1.
// Banco e push simulados: nenhum envio real, nenhuma conta real.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
const query = vi.fn();
const sendPushToUser = vi.fn();
const recordEvent = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));
vi.mock('@/lib/events', () => ({ recordEvent: (...a: unknown[]) => recordEvent(...a) }));

import { GET } from '@/app/api/v1/cron/found-pending-reminders/route';

const SECRET = 'segredo-de-teste';
const call = (auth: string | null = `Bearer ${SECRET}`) =>
  GET(new NextRequest('http://x/api/v1/cron/found-pending-reminders', { headers: auth ? { authorization: auth } : {} }));

const sha = (s: string) => createHash('sha256').update(s.replace(/\s+/g, ' ').trim()).digest('hex');

/** Banco simulado: devolve linhas por janela e lembra os lembretes já gravados (dedup). */
function fakeDb(rows: { d1?: Row[]; d3?: Row[]; d7?: Row[]; d14?: Row[] }) {
  const events = new Set<string>();
  const sqls: Record<string, string> = {};
  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    const insert = /INSERT INTO user_lifecycle_events/.test(sql);
    if (insert) {
      const type = /'(found_pending_reminder_d\d)'/.exec(sql)![1];
      events.add(`${type}:${params![1]}`);
      return { rows: [], rowCount: 1 };
    }
    const pick = (key: keyof typeof rows, type: string) => {
      sqls[key] = sql;
      return { rows: (rows[key] ?? []).filter(r => !events.has(`${type}:${r.id}`)) };
    };
    if (/INTERVAL '1 days?'/.test(sql) && /found_pending_reminder_d1/.test(sql)) return pick('d1', 'found_pending_reminder_d1');
    if (/INTERVAL '3 days'/.test(sql)) return pick('d3', 'found_pending_reminder_d3');
    if (/INTERVAL '7 days'/.test(sql)) return pick('d7', 'found_pending_reminder_d7');
    if (/UPDATE objects/.test(sql)) { sqls.d14 = sql; return { rows: rows.d14 ?? [] }; }
    return { rows: [] };
  });
  return { events, sqls };
}

beforeEach(() => {
  query.mockReset(); sendPushToUser.mockReset(); recordEvent.mockReset();
  sendPushToUser.mockResolvedValue(undefined); recordEvent.mockResolvedValue(undefined);
  process.env.CRON_SECRET = SECRET;
});

describe('autenticação (inalterada)', () => {
  it.each([[null], ['Bearer errado'], ['segredo-de-teste']])('recusa %s com 401 e não consulta o banco', async (h) => {
    expect((await call(h)).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
  it('sem CRON_SECRET configurado recusa tudo (fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
  });
});

describe('D+3, D+7 e D+14 continuam idênticos', () => {
  it('consultas e textos', async () => {
    const { sqls } = fakeDb({
      d3: [{ id: 'o3', user_id: 'u3', title: 'Mochila' }],
      d7: [{ id: 'o7', user_id: 'u7', title: 'Chave' }],
      d14: [{ id: 'o14', user_id: 'u14' }],
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders_d1: 0, reminders_d3: 1, reminders_d7: 1, auto_dismissed_d14: 1, errors: [] });

    // textos e destinatários exatos
    const pushes = sendPushToUser.mock.calls.filter(c => /found-pending-d[37]-/.test((c[1] as { tag: string }).tag));
    expect(pushes).toEqual([
      ['u3', {
        title: '👀 Ainda esperando sua confirmação',
        body: 'Alguém sinalizou que encontrou "Mochila" há 3 dias. Confirme ou descarte na página do objeto.',
        url: '/dashboard/objects/o3', tag: 'found-pending-d3-o3',
      }],
      ['u7', {
        title: '⏳ Última chance antes de descartarmos sozinhos',
        body: '"Chave" tem uma sinalização de "encontrei" aberta há 7 dias. Sem resposta até o dia 14, ela será descartada automaticamente.',
        url: '/dashboard/objects/o7', tag: 'found-pending-d7-o7',
      }],
    ]);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ object_id: 'o14', user_id: 'u14', type: 'found_pending_auto_dismissed', source: 'system' }));

    // consultas (texto normalizado) idênticas às de antes desta entrega
    expect(sha(sqls.d3)).toBe(HASH.d3);
    expect(sha(sqls.d7)).toBe(HASH.d7);
    expect(sha(sqls.d14)).toBe(HASH.d14);
  });
});

const HASH = {
  d3: 'bc6294095a07616998112eb7f8099934413f8b820304872ca8f3e0a369f23dac',
  d7: 'd92a42498d090d8d4fdc517c7cd19bdafbc2d087c48df7d7c6d808585d7360da',
  d14: '4c1da77e0625bc1191daf8a720d277209395392a5f9b6da63778153c30451434',
};
if (process.env.PRINT_HASH) {
  it('imprime hashes', async () => {
    const { sqls } = fakeDb({});
    await call();
    console.log('HASH', JSON.stringify({ d3: sha(sqls.d3), d7: sha(sqls.d7), d14: sha(sqls.d14) }));
  });
}

describe('D+1 (novo)', () => {
  const row = { id: 'o1', user_id: 'u1', title: 'Carteira' };

  it('envia uma vez, com o texto simples e a preferência do evento qr_scan', async () => {
    fakeDb({ d1: [row] });
    const body = await (await call()).json();
    expect(body).toMatchObject({ reminders_d1: 1, reminders_d3: 0, reminders_d7: 0, auto_dismissed_d14: 0, errors: [] });
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    const [uid, payload, opts] = sendPushToUser.mock.calls[0];
    expect(uid).toBe('u1');
    expect(opts).toEqual({ event: 'qr_scan' });
    expect(payload).toEqual({
      title: '👀 Sinalização aguardando sua resposta',
      body: 'Alguém sinalizou que encontrou "Carteira". Confirme ou descarte na página do objeto.',
      url: '/dashboard/objects/o1', tag: 'found-pending-d1-o1',
    });
    expect(JSON.stringify(payload)).not.toMatch(/proteg|ocult|revelad|SMS/i);
  });

  it('segunda execução não repete (dedup por user_lifecycle_events)', async () => {
    const { events } = fakeDb({ d1: [row] });
    await call();
    expect(events.has('found_pending_reminder_d1:o1')).toBe(true);
    await call();
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it('janela de 1 dia <= idade < 2 dias e mesmas exclusões das outras janelas', async () => {
    const { sqls } = fakeDb({ d1: [] });
    await call();
    const q = sqls.d1.replace(/\s+/g, ' ');
    expect(q).toContain("found_pending_since <= NOW() - INTERVAL '1 day'");
    expect(q).toContain("found_pending_since > NOW() - INTERVAL '2 days'");
    expect(q).toContain('o.is_legacy IS NOT TRUE');
    expect(q).toContain('ux.is_legacy IS TRUE OR ux.is_system_account IS TRUE');
    expect(q).toContain("event_type = 'found_pending_reminder_d1'");
  });

  it('sem linhas (legado e conta de sistema ficam fora da consulta): nenhum push', async () => {
    fakeDb({});
    expect(await (await call()).json()).toMatchObject({ reminders_d1: 0 });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('falha do push de um objeto não derruba os demais nem grava o lembrete', async () => {
    const { events } = fakeDb({ d1: [row, { id: 'o2', user_id: 'u2', title: 'Chave' }] });
    sendPushToUser.mockRejectedValueOnce(new Error('falhou'));
    const body = await (await call()).json();
    expect(body.reminders_d1).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(events.has('found_pending_reminder_d1:o1')).toBe(false);
    expect(events.has('found_pending_reminder_d1:o2')).toBe(true);
  });

  it('erro na consulta D+1 não impede D+3, D+7 e D+14', async () => {
    fakeDb({ d3: [{ id: 'o3', user_id: 'u3', title: 'Mochila' }] });
    const orig = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, p?: unknown[]) => {
      if (/found_pending_reminder_d1/.test(sql) && /SELECT/.test(sql)) throw new Error('boom');
      return orig(sql, p);
    });
    const body = await (await call()).json();
    expect(body.reminders_d3).toBe(1);
    expect(body.errors).toHaveLength(1);
  });
});
