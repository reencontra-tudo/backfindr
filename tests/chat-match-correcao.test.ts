// Chat de MATCH (existente): só com match confirmado, nome de quem escreve, texto sem promessa de dados protegidos, push com texto fixo. Banco simulado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

const st = vi.hoisted(() => ({ match: null as Record<string, unknown> | null, msgs: [] as Record<string, unknown>[], inserted: [] as unknown[][], pushes: [] as unknown[] }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM matches m')) return { rows: st.match ? [st.match] : [] };
    if (sql.includes('INSERT INTO chat_messages')) { st.inserted.push(params); return { rows: [{ id: 'msg1', match_id: params[0], sender_id: params[1], message: params[2], created_at: 'agora', message_type: 'text' }] }; }
    if (sql.includes('FROM chat_messages cm')) return { rows: st.msgs };
    if (sql.includes('FROM users')) return { rows: [{ name: 'Ana Teste' }] };
    return { rows: [] };
  }),
}));
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => (t === 'invalido' ? null : { sub: t }) }));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async (...a: unknown[]) => { st.pushes.push(a); }), chatPayload: () => ({}) }));

import { GET, POST } from '@/app/api/v1/chat/[matchId]/messages/route';
const req = (tok: string | null, body?: unknown) => new NextRequest('http://localhost/api/v1/chat/m1/messages', { method: body ? 'POST' : 'GET', headers: tok ? { authorization: `Bearer ${tok}` } : {}, body: body ? JSON.stringify(body) : undefined });
const ctx = { params: { matchId: 'm1' } };
const M = (status: string) => ({ id: 'm1', status, lost_user_id: 'dono', found_user_id: 'achador' });
beforeEach(() => { st.match = M('confirmed'); st.msgs = []; st.inserted = []; st.pushes = []; });

describe('mensagens do chat de match: status do match', () => {
  for (const s of ['pending', 'rejected', 'qualquer']) it(`match ${s}: GET e POST recusam (409) e nada é gravado`, async () => {
    st.match = M(s);
    expect((await GET(req('dono'), ctx)).status).toBe(409);
    expect((await POST(req('dono', { message: 'oi' }), ctx)).status).toBe(409);
    expect(st.inserted.length).toBe(0);
  });
  it('match confirmado: lê e grava normalmente (201), para os dois lados', async () => {
    expect((await GET(req('achador'), ctx)).status).toBe(200);
    expect((await POST(req('dono', { message: 'oi' }), ctx)).status).toBe(201);
    expect(st.inserted.length).toBe(1);
  });
  it('quem não é parte continua barrado (mesmo com match confirmado) e sem token também', async () => {
    expect((await GET(req('intruso'), ctx)).status).toBe(401); expect((await POST(req('intruso', { message: 'x' }), ctx)).status).toBe(401);
    expect((await GET(req(null), ctx)).status).toBe(401); expect(st.inserted.length).toBe(0);
  });
  it('match inexistente: 404', async () => { st.match = null; expect((await GET(req('dono'), ctx)).status).toBe(404); });
});

describe('mensagens: nome de quem escreve e mensagem de sistema', () => {
  it('a resposta traz sender_name e is_system (a tela mostrava «?»)', async () => {
    st.msgs = [{ id: 'a', match_id: 'm1', sender_id: 'dono', message: 'oi', created_at: 't', sender_name: 'Ana Teste', is_system: false }, { id: 'b', match_id: 'm1', sender_id: 'dono', message: 'sistema', created_at: 't', sender_name: 'Alguém', is_system: true }];
    const j = await (await GET(req('dono'), ctx)).json(); const m = (j.data ?? j).messages;
    expect(m[0].sender_name).toBe('Ana Teste'); expect(m[0].is_system).toBe(false); expect(m[1].is_system).toBe(true); expect(m[0].content).toBe('oi');
  });
  it('a consulta junta o nome e usa message_type', () => {
    const c = readFileSync(path.join(__dirname, '..', 'src/app/api/v1/chat/[matchId]/messages/route.ts'), 'utf8');
    expect(c).toContain('LEFT JOIN users u ON u.id = cm.sender_id'); expect(c).toContain("cm.message_type = 'system'"); expect(c).toContain("m.status");
  });
});

describe('texto da tela e push', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('a tela não promete dados protegidos nem «mediada»', () => {
    const c = r('src/app/dashboard/chat/[matchId]/page.tsx');
    expect(c).not.toMatch(/mediada|não são expostos|forma segura/); expect(c).toContain('Não envie telefone, e-mail nem endereço.');
    expect(c).toContain("m.status !== 'confirmed'");
  });
  it('push de chat com texto fixo (sem mensagem nem nome) e push de match pendente leva à lista de matches', async () => {
    const { chatPayload, matchPayload } = await vi.importActual<typeof import('@/lib/pushNotification')>('@/lib/pushNotification');
    expect(JSON.stringify(chatPayload('Ana', 'm1', 'meu telefone 11 99999-9999'))).not.toMatch(/Ana|telefone|99999/);
    expect(matchPayload('m1', 'Chave', 0.9).url).toBe('/dashboard/matches');
  });
});
