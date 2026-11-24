// Checkout do Mercado Pago ENDURECIDO (24/11/2026): exige login e, no boost, que o objeto exista e seja de quem paga. Banco e Mercado Pago simulados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const st = vi.hoisted(() => ({ donoDoObjeto: true, sqls: [] as string[], params: [] as unknown[][], preferencias: [] as unknown[] }));
vi.mock('@/lib/jwt', () => ({ verifyToken: (t: string) => (t === 'ruim' ? null : { sub: t }) }));
vi.mock('@/lib/db', () => ({ query: vi.fn(async (sql: string, params: unknown[] = []) => { st.sqls.push(sql); st.params.push(params); return { rows: st.donoDoObjeto ? [{ '?column?': 1 }] : [] }; }) }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class { constructor(_: unknown) {} },
  Preference: class { async create(a: { body: unknown }) { st.preferencias.push(a.body); return { id: 'p', init_point: 'https://x', sandbox_init_point: 'https://y' }; } },
}));
vi.spyOn(console, 'error').mockImplementation(() => {});
import { POST } from '@/app/api/v1/checkout/mercadopago/route';

const chama = (body: unknown, auth: string | null) =>
  POST(new NextRequest('http://localhost/api/v1/checkout/mercadopago', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) }));

beforeEach(() => { process.env.MP_ACCESS_TOKEN = 'TEST-x'; process.env.NEXT_PUBLIC_MODO_CRESCIMENTO = '0'; st.donoDoObjeto = true; st.sqls = []; st.params = []; st.preferencias = []; });

describe('checkout: login obrigatório', () => {
  it('sem login (ou token inválido): 401 em plano e em boost; nenhuma preferência criada', async () => {
    for (const auth of [null, 'ruim']) {
      expect((await chama({ type: 'plan', plan_slug: 'pro' }, auth)).status).toBe(401);
      expect((await chama({ type: 'boost', boost_type: 'boost_7', object_id: 'o1' }, auth)).status).toBe(401);
    }
    expect(st.preferencias.length).toBe(0);
  });
  it('o valor «anonymous» não existe mais no código do checkout', async () => {
    const { readFileSync } = await import('node:fs'); const s = readFileSync('src/app/api/v1/checkout/mercadopago/route.ts', 'utf8');
    expect(s).not.toMatch(/user\?\.sub \|\| "anonymous"/);
  });
});

describe('checkout de boost: dono do objeto', () => {
  it('objeto do próprio usuário: cria a preferência com o usuário e o objeto nos metadados', async () => {
    const r = await chama({ type: 'boost', boost_type: 'boost_7', object_id: 'o1' }, 'u1');
    expect(r.status).toBe(200);
    const meta = (st.preferencias[0] as { metadata: Record<string, string> }).metadata;
    expect(meta).toMatchObject({ type: 'boost', object_id: 'o1', user_id: 'u1', days: '7' });
    expect(st.params[0]).toEqual(['o1', 'u1']);
  });
  it('objeto de OUTRA pessoa ou inexistente: 404 igual nos dois casos (não revela), nenhuma preferência', async () => {
    st.donoDoObjeto = false;
    const r = await chama({ type: 'boost', boost_type: 'boost_7', object_id: 'o2' }, 'u1');
    expect(r.status).toBe(404); expect(st.preferencias.length).toBe(0);
  });
  it('sem objeto informado: 400; tipo de boost inválido: 400', async () => {
    expect((await chama({ type: 'boost', boost_type: 'boost_7' }, 'u1')).status).toBe(400);
    expect((await chama({ type: 'boost', boost_type: 'xyz', object_id: 'o1' }, 'u1')).status).toBe(400);
  });
});

describe('checkout de plano (com o modo crescimento DESLIGADO)', () => {
  it('logado: cria a preferência com o usuário real', async () => {
    const r = await chama({ type: 'plan', plan_slug: 'pro' }, 'u1');
    expect(r.status).toBe(200); expect((st.preferencias[0] as { metadata: Record<string, string> }).metadata).toMatchObject({ type: 'plan', plan_id: 'pro', user_id: 'u1' });
  });
  it('plano inválido: 400', async () => { expect((await chama({ type: 'plan', plan_slug: 'xyz' }, 'u1')).status).toBe(400); });
});
