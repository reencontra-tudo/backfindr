// Mensagens de chat não lidas: contagem, marcação, acesso e coluna/tabela ausente. Banco simulado (sem rede).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const query = vi.fn();
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => query(...a) }));
vi.mock('@/lib/jwt', () => ({
  extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null),
  verifyToken: (t: string) => (t === 'invalido' ? null : { sub: t }),
}));

import { getUnreadSummary, markConversationRead } from '@/lib/chatUnread';
import { GET as unreadGET } from '@/app/api/v1/chat/unread/route';
import { POST as readPOST } from '@/app/api/v1/chat/[matchId]/read/route';

const M1 = '11111111-1111-1111-1111-111111111111';
const M2 = '22222222-2222-2222-2222-222222222222';
const pgErr = (code: string) => Object.assign(new Error('pg'), { code });

beforeEach(() => query.mockReset());

describe('getUnreadSummary', () => {
  it('soma por conversa e no total', async () => {
    query.mockResolvedValueOnce({ rows: [{ match_id: M1, n: 2 }, { match_id: M2, n: '3' }] });
    expect(await getUnreadSummary('u1')).toEqual({ total: 5, by_match: { [M1]: 2, [M2]: 3 } });
  });
  it('só conta mensagens dos outros, não lidas e dentro da janela de 30 dias', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getUnreadSummary('u1');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/cm\.sender_id <> \$1/);
    expect(sql).toMatch(/cm\.is_read IS NOT TRUE/);
    expect(sql).toMatch(/lo\.user_id = \$1 OR fo\.user_id = \$1/);
    expect(params).toEqual(['u1', '30']);
  });
  it('sem mensagens: zero', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getUnreadSummary('u1')).toEqual({ total: 0, by_match: {} });
  });
  it('coluna ou tabela ausente: zero, sem erro (comportamento de hoje)', async () => {
    query.mockRejectedValueOnce(pgErr('42703'));
    expect(await getUnreadSummary('u1')).toEqual({ total: 0, by_match: {} });
    query.mockRejectedValueOnce(pgErr('42P01'));
    expect(await getUnreadSummary('u1')).toEqual({ total: 0, by_match: {} });
  });
  it('outro erro de banco continua sendo erro', async () => {
    query.mockRejectedValueOnce(pgErr('57P01'));
    await expect(getUnreadSummary('u1')).rejects.toThrow();
  });
});

describe('markConversationRead', () => {
  it('marca só o que os outros enviaram e devolve quantas mudaram', async () => {
    query.mockResolvedValueOnce({ rowCount: 2, rows: [] });
    expect(await markConversationRead(M1, 'u1')).toBe(2);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SET is_read = TRUE/);
    expect(sql).toMatch(/sender_id <> \$2/);
    expect(params).toEqual([M1, 'u1']);
  });
  it('coluna ausente: 0, sem erro', async () => {
    query.mockRejectedValueOnce(pgErr('42703'));
    expect(await markConversationRead(M1, 'u1')).toBe(0);
  });
});

const req = (url: string, token?: string, method = 'GET') =>
  new NextRequest(url, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('GET /api/v1/chat/unread', () => {
  it('sem token ou token inválido: 401', async () => {
    expect((await unreadGET(req('http://x/api/v1/chat/unread'))).status).toBe(401);
    expect((await unreadGET(req('http://x/api/v1/chat/unread', 'invalido'))).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
  it('devolve o resumo do usuário do token', async () => {
    query.mockResolvedValueOnce({ rows: [{ match_id: M1, n: 4 }] });
    const res = await unreadGET(req('http://x/api/v1/chat/unread', 'u1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 4, by_match: { [M1]: 4 } });
    expect(query.mock.calls[0][1][0]).toBe('u1');
  });
  it('coluna ausente: 200 com zero', async () => {
    query.mockRejectedValueOnce(pgErr('42703'));
    const res = await unreadGET(req('http://x/api/v1/chat/unread', 'u1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 0 });
  });
});

describe('POST /api/v1/chat/[matchId]/read', () => {
  const call = (token?: string) =>
    readPOST(req(`http://x/api/v1/chat/${M1}/read`, token, 'POST'), { params: { matchId: M1 } });

  it('sem token: 401', async () => {
    expect((await call()).status).toBe(401);
  });
  it('conversa inexistente: 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect((await call('u1')).status).toBe(404);
  });
  it('usuário que não participa da conversa: 401 e nada é marcado', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: M1, lost_user_id: 'a', found_user_id: 'b' }] });
    expect((await call('intruso')).status).toBe(401);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each(['a', 'b'])('participante %s marca como lidas', async (who) => {
    query.mockResolvedValueOnce({ rows: [{ id: M1, lost_user_id: 'a', found_user_id: 'b' }] });
    query.mockResolvedValueOnce({ rowCount: 3, rows: [] });
    const res = await call(who);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ match_id: M1, marked: 3 });
    expect(query.mock.calls[1][1]).toEqual([M1, who]);
  });
  it('coluna ausente: 200 com marked 0', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: M1, lost_user_id: 'a', found_user_id: 'b' }] });
    query.mockRejectedValueOnce(pgErr('42703'));
    const res = await call('a');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ marked: 0 });
  });
});
