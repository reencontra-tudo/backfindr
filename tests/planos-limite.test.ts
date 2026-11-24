// PL-01 (decisão do fundador, 24/11/2026): limite do plano free PAUSADO. Free = teto anti-abuso (100 objetos ativos e 10 cadastros em 24 h);
// Pro (50) e Business (500) inalterados; a contagem ignora arquivados, devolvidos, apagados e legados, para TODOS os planos. Banco simulado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LIMITES_DOS_PLANOS, limitesDoPlano, mensagemDeLimite, STATUS_QUE_NAO_CONTAM } from '@/lib/planos';

const st = vi.hoisted(() => ({ plano: 'free', expira: null as string | null, ativos: 0, hoje: 0, sqls: [] as string[], params: [] as unknown[][] }));
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => ({ sub: t }) }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    st.sqls.push(sql); st.params.push(params);
    if (/SELECT plan, plan_expires_at FROM users/.test(sql)) return { rows: [{ plan: st.plano, plan_expires_at: st.expira }] };
    if (/COUNT\(\*\) FILTER/.test(sql)) return { rows: [{ ativos: String(st.ativos), hoje: String(st.hoje) }] };
    throw new Error('parou depois do limite (esperado nestes testes)');
  }),
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));

import { POST } from '@/app/api/v1/objects/route';
const chama = async () => {
  const res = await POST(new NextRequest('http://localhost/api/v1/objects', { method: 'POST', headers: { authorization: 'Bearer u1', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', status: 'lost', category: 'other' }) }));
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: (body?.data ?? body) as Record<string, unknown> };
};
beforeEach(() => { st.plano = 'free'; st.expira = null; st.ativos = 0; st.hoje = 0; st.sqls = []; st.params = []; });

describe('limites por plano (fonte única)', () => {
  it('free 100 + 10 por dia; Pro 50 e Business 500 como antes', () => {
    expect(LIMITES_DOS_PLANOS.free).toEqual({ maxObjetos: 100, maxPorDia: 10 });
    expect(LIMITES_DOS_PLANOS.pro).toEqual({ maxObjetos: 50, maxPorDia: null });
    expect(LIMITES_DOS_PLANOS.business).toEqual({ maxObjetos: 500, maxPorDia: null });
  });
  it('plano desconhecido ou vazio cai no free', () => { for (const p of ['xyz', '', null, undefined]) expect(limitesDoPlano(p)).toEqual(LIMITES_DOS_PLANOS.free); });
  it('não contam: apagados, arquivados e devolvidos', () => { expect([...STATUS_QUE_NAO_CONTAM].sort()).toEqual(['archived', 'deleted', 'returned']); });
  it('mensagens: total e diária, sem «3 objetos»', () => {
    const t = mensagemDeLimite('total', 'free', LIMITES_DOS_PLANOS.free), d = mensagemDeLimite('diario', 'free', LIMITES_DOS_PLANOS.free);
    expect(t).toContain('100 objetos ativos'); expect(d).toContain('10 ocorrências'); expect(t + d).not.toMatch(/\b3 objeto/);
  });
});

describe('POST /api/v1/objects: decisão do limite', () => {
  it('free com 3 objetos NÃO é mais barrado (o limite antigo está pausado)', async () => {
    st.ativos = 3; st.hoje = 0;
    const r = await chama(); expect(r.body.error).not.toBe('limit_reached');
  });
  it('free com 99 ativos passa; com 100 é barrado pelo TETO TOTAL (403)', async () => {
    st.ativos = 99; expect((await chama()).body.error).not.toBe('limit_reached');
    st.ativos = 100; const r = await chama();
    expect(r.status).toBe(403); expect(r.body.error).toBe('limit_reached'); expect(r.body.limit_type).toBe('total'); expect(r.body.max_objects).toBe(100);
  });
  it('free: 9 cadastros nas últimas 24 h passa; 10 é barrado pelo teto DIÁRIO (403)', async () => {
    st.hoje = 9; expect((await chama()).body.error).not.toBe('limit_reached');
    st.hoje = 10; const r = await chama();
    expect(r.status).toBe(403); expect(r.body.limit_type).toBe('diario'); expect(String(r.body.message)).toContain('24 horas');
  });
  it('Pro: 49 passa, 50 barra (inalterado); sem limite diário', async () => {
    st.plano = 'pro'; st.ativos = 49; st.hoje = 30; expect((await chama()).body.error).not.toBe('limit_reached');
    st.ativos = 50; const r = await chama(); expect(r.status).toBe(403); expect(r.body.max_objects).toBe(50); expect(r.body.limit_type).toBe('total');
  });
  it('Business: 499 passa, 500 barra (inalterado)', async () => {
    st.plano = 'business'; st.ativos = 499; expect((await chama()).body.error).not.toBe('limit_reached');
    st.ativos = 500; const r = await chama(); expect(r.status).toBe(403); expect(r.body.max_objects).toBe(500);
  });
  it('plano pago VENCIDO volta a valer como free (teto do free)', async () => {
    st.plano = 'pro'; st.expira = '2020-01-01T00:00:00Z'; st.ativos = 60;
    expect((await chama()).body.error).not.toBe('limit_reached');
  });
  it('a contagem exclui deleted/archived/returned e legados (parâmetro e SQL)', async () => {
    await chama();
    const i = st.sqls.findIndex((s) => /COUNT\(\*\) FILTER/.test(s));
    expect(st.params[i][1]).toEqual(['deleted', 'archived', 'returned']);
    expect(st.sqls[i]).toContain("COALESCE(is_legacy, false) = false");
    expect(st.sqls[i]).toContain("INTERVAL '24 hours'");
  });
});

describe('textos: nenhum cita mais o limite de 3', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  const ARQUIVOS = [
    'src/app/api/v1/objects/route.ts', 'src/app/api/v1/billing/status/route.ts', 'src/app/api/v1/plans/route.ts', 'src/app/admin/planos/page.tsx',
    'src/app/api/v1/admin/migrate/route.ts', 'src/app/api/v1/admin/migrate-tables/route.ts', 'src/app/pricing/client.tsx', 'src/app/faq/client.tsx',
    'src/components/AssistantWidget.tsx', 'src/app/api/v1/assistant/chat/route.ts', 'src/lib/api.ts', 'src/app/dashboard/billing/page.tsx',
  ];
  it('«3 objetos», «até 3» e «limite de 3» não aparecem mais nos 12 lugares do levantamento', () => {
    for (const f of ARQUIVOS) expect(r(f), f).not.toMatch(/\b3 objetos|[Aa]té 3 obj|limite de 3 obj|max_objects: 3,/);
  });
  it('Pro não vende mais quantidade de objetos', () => {
    for (const f of ['src/app/pricing/client.tsx', 'src/app/api/v1/plans/route.ts', 'src/app/faq/client.tsx', 'src/components/AssistantWidget.tsx', 'src/app/api/v1/assistant/chat/route.ts', 'src/app/dashboard/billing/page.tsx'])
      expect(r(f), f).not.toMatch(/(?<![\d.])50 objetos|Até 50 obj|até 20 registros/);
  });
  it('free: «Cadastre quantos precisar» nas páginas de preços e FAQ', () => {
    expect(r('src/app/pricing/client.tsx')).toContain('Cadastre quantos precisar'); expect(r('src/app/faq/client.tsx')).toContain('quantos');
  });
  it('a rota e o status leem a fonte única (src/lib/planos.ts)', () => {
    expect(r('src/app/api/v1/objects/route.ts')).toContain("from '@/lib/planos'"); expect(r('src/app/api/v1/billing/status/route.ts')).toContain("from '@/lib/planos'");
    expect(r('src/app/api/v1/objects/route.ts')).not.toContain('PLAN_MAX_OBJECTS =');
  });
});
