// PL-01 — PAUSAR, NÃO APAGAR (decisão do fundador, 24/11/2026). Interruptor único: NEXT_PUBLIC_MODO_CRESCIMENTO (ausente ou ≠ «0» = LIGADO; «0» = DESLIGADO).
//  LIGADO   : free com teto anti-abuso (100 ativos, 10 por 24 h); Pro e Business escondidos; nenhuma nova assinatura; textos de crescimento.
//  DESLIGADO: tudo IDÊNTICO ao comportamento anterior ao PL-01 (free 3, Pro 50, Business 500, textos e respostas originais).
//  Nos DOIS estados: a nova contagem (sem arquivados, devolvidos, apagados e legados) e as contas pagas intactas. Banco simulado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { modoCrescimento, assinaturasPausadas, TEXTOS_CRESCIMENTO } from '@/lib/modoCrescimento';
import { LIMITES_CRESCIMENTO, LIMITES_ORIGINAIS, limitesDoPlano, mensagemDeLimite, STATUS_QUE_NAO_CONTAM } from '@/lib/planos';
import { promptDoModo } from '@/lib/promptAssistente';

const st = vi.hoisted(() => ({
  plano: 'free', expira: null as string | null, ativos: 0, hoje: 0, sqls: [] as string[], params: [] as unknown[][],
  planConfigs: [] as Record<string, unknown>[],
}));
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => ({ sub: t }) }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    st.sqls.push(sql); st.params.push(params);
    if (/FROM plan_configs/.test(sql)) return { rows: st.planConfigs };
    if (/SELECT plan, plan_expires_at FROM users/.test(sql)) return { rows: [{ plan: st.plano, plan_expires_at: st.expira }] };
    if (/FROM users WHERE id/.test(sql)) return { rows: [{ id: 'u1', email: 'a@b.c', name: 'N', plan: st.plano, plan_expires_at: st.expira, subscription_provider: null, mp_subscription_id: null, stripe_subscription_id: null }] };
    if (/COUNT\(\*\) FILTER/.test(sql)) return { rows: [{ ativos: String(st.ativos), hoje: String(st.hoje) }] };
    throw new Error('parou depois do limite (esperado nestes testes)');
  }),
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.mock('@/lib/socialPost', () => ({ enqueueSocialPosts: () => Promise.resolve() }));
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

import { POST as postObjeto } from '@/app/api/v1/objects/route';
import { GET as getStatus } from '@/app/api/v1/billing/status/route';
import { GET as getPlans } from '@/app/api/v1/plans/route';
import { POST as postCheckout } from '@/app/api/v1/checkout/mercadopago/route';
import { POST as postBilling } from '@/app/api/v1/billing/route';
import { POST as postStripe } from '@/app/api/stripe/checkout/route';
import { secoesDoFaq, SECTIONS_ORIGINAIS } from '@/app/faq/client';

const req = (url: string, body: unknown, auth = 'Bearer u1') =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const lerObjeto = async () => {
  const res = await postObjeto(req('/api/v1/objects', { title: 'x', status: 'lost', category: 'other' }));
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: (body?.data ?? body) as Record<string, unknown> };
};
const ligar = () => { delete process.env.NEXT_PUBLIC_MODO_CRESCIMENTO; };
const desligar = () => { process.env.NEXT_PUBLIC_MODO_CRESCIMENTO = '0'; };
const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');

beforeEach(() => { ligar(); st.plano = 'free'; st.expira = null; st.ativos = 0; st.hoje = 0; st.sqls = []; st.params = []; st.planConfigs = []; });
afterEach(() => { ligar(); });

describe('interruptor único', () => {
  it('ausente = LIGADO; «0» = DESLIGADO; qualquer outro valor = LIGADO', () => {
    ligar(); expect(modoCrescimento()).toBe(true); expect(assinaturasPausadas()).toBe(true);
    desligar(); expect(modoCrescimento()).toBe(false); expect(assinaturasPausadas()).toBe(false);
    for (const v of ['1', 'true', '', 'sim']) { process.env.NEXT_PUBLIC_MODO_CRESCIMENTO = v; expect(modoCrescimento()).toBe(true); }
  });
});

describe('limites por plano e estado', () => {
  it('LIGADO: free 100 + 10/dia; Pro 50 e Business 500 (contas pagas intactas)', () => {
    expect(limitesDoPlano('free', true)).toEqual({ maxObjetos: 100, maxPorDia: 10 });
    expect(limitesDoPlano('pro', true)).toEqual({ maxObjetos: 50, maxPorDia: null });
    expect(limitesDoPlano('business', true)).toEqual({ maxObjetos: 500, maxPorDia: null });
  });
  it('DESLIGADO: exatamente os valores de ANTES do PL-01 (free 3, Pro 50, Business 500, sem limite diário)', () => {
    expect(LIMITES_ORIGINAIS).toEqual({ free: { maxObjetos: 3, maxPorDia: null }, pro: { maxObjetos: 50, maxPorDia: null }, business: { maxObjetos: 500, maxPorDia: null } });
    expect(limitesDoPlano('free', false)).toEqual({ maxObjetos: 3, maxPorDia: null });
  });
  it('Pro e Business são iguais nos dois estados', () => { for (const p of ['pro', 'business'] as const) expect(LIMITES_CRESCIMENTO[p]).toEqual(LIMITES_ORIGINAIS[p]); });
  it('plano desconhecido cai no free do estado', () => { expect(limitesDoPlano('xyz', true)).toEqual(LIMITES_CRESCIMENTO.free); expect(limitesDoPlano(null, false)).toEqual(LIMITES_ORIGINAIS.free); });
  it('mensagem DESLIGADO = texto original; LIGADO = sem convite a planos pagos', () => {
    expect(mensagemDeLimite('total', 'free', LIMITES_ORIGINAIS.free, false)).toBe('Você atingiu o limite de 3 objetos do plano free. Faça upgrade para adicionar mais.');
    expect(mensagemDeLimite('total', 'pro', LIMITES_ORIGINAIS.pro, false)).toBe('Você atingiu o limite de 50 objetos do plano pro. Faça upgrade para adicionar mais.');
    const t = mensagemDeLimite('total', 'free', LIMITES_CRESCIMENTO.free, true) + mensagemDeLimite('diario', 'free', LIMITES_CRESCIMENTO.free, true);
    expect(t).not.toMatch(/upgrade|pricing|plano pago|Pro\b|Business/);
  });
  it('não contam: apagados, arquivados e devolvidos', () => { expect([...STATUS_QUE_NAO_CONTAM].sort()).toEqual(['archived', 'deleted', 'returned']); });
});

describe('POST /api/v1/objects', () => {
  it('LIGADO: free com 3 não é mais barrado; 99 passa; 100 barra pelo teto total (sem upgrade_url)', async () => {
    st.ativos = 3; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
    st.ativos = 99; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
    st.ativos = 100; const x = await lerObjeto();
    expect(x.status).toBe(403); expect(x.body.limit_type).toBe('total'); expect(x.body.max_objects).toBe(100); expect(x.body.upgrade_url).toBeUndefined();
  });
  it('LIGADO: 9 cadastros em 24 h passa; 10 barra pelo teto diário', async () => {
    st.hoje = 9; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
    st.hoje = 10; const x = await lerObjeto(); expect(x.status).toBe(403); expect(x.body.limit_type).toBe('diario');
  });
  it('DESLIGADO = comportamento de antes: free 2 passa, 3 barra com a mensagem original e upgrade_url; sem limite diário', async () => {
    desligar();
    st.ativos = 2; st.hoje = 50; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
    st.ativos = 3; const x = await lerObjeto();
    expect(x.status).toBe(403); expect(x.body.error).toBe('limit_reached'); expect(x.body.max_objects).toBe(3);
    expect(x.body.message).toBe('Você atingiu o limite de 3 objetos do plano free. Faça upgrade para adicionar mais.'); expect(x.body.upgrade_url).toBe('/pricing');
  });
  for (const estado of ['ligado', 'desligado'] as const) {
    it(`CONTAS PAGAS INTACTAS (${estado}): Pro 49 passa / 50 barra; Business 499 passa / 500 barra; sem limite diário`, async () => {
      if (estado === 'desligado') desligar();
      st.plano = 'pro'; st.ativos = 49; st.hoje = 80; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
      st.ativos = 50; let x = await lerObjeto(); expect(x.status).toBe(403); expect(x.body.max_objects).toBe(50); expect(x.body.plan).toBe('pro');
      st.plano = 'business'; st.ativos = 499; expect((await lerObjeto()).body.error).not.toBe('limit_reached');
      st.ativos = 500; x = await lerObjeto(); expect(x.status).toBe(403); expect(x.body.max_objects).toBe(500);
    });
    it(`plano pago VENCIDO volta a valer como free do estado (${estado})`, async () => {
      if (estado === 'desligado') desligar();
      st.plano = 'pro'; st.expira = '2020-01-01T00:00:00Z'; st.ativos = 3;
      const x = await lerObjeto(); if (estado === 'desligado') expect(x.body.max_objects).toBe(3); else expect(x.body.error).not.toBe('limit_reached');
    });
    it(`a nova CONTAGEM vale nos dois estados: exclui deleted/archived/returned e legados (${estado})`, async () => {
      if (estado === 'desligado') desligar();
      await lerObjeto();
      const i = st.sqls.findIndex((q) => /COUNT\(\*\) FILTER/.test(q));
      expect(st.params[i][1]).toEqual(['deleted', 'archived', 'returned']); expect(st.sqls[i]).toContain('COALESCE(is_legacy, false) = false');
    });
  }
});

describe('GET /api/v1/billing/status (contas pagas e free)', () => {
  const status = async () => { const res = await getStatus(new NextRequest('http://localhost/api/v1/billing/status', { headers: { authorization: 'Bearer u1' } })); const b = await res.json(); return (b?.data ?? b) as { plan: string; is_pro: boolean; is_paid: boolean; features: { max_objects: number; ai_matching: boolean; push_notifications: boolean } }; };
  for (const estado of ['ligado', 'desligado'] as const) {
    it(`conta Pro ativa (${estado}): plano, benefícios e limite 50 exatamente iguais`, async () => {
      if (estado === 'desligado') desligar();
      st.plano = 'pro'; st.expira = '2099-01-01T00:00:00Z';
      const s = await status(); expect(s.plan).toBe('pro'); expect(s.is_pro).toBe(true); expect(s.is_paid).toBe(true);
      expect(s.features).toEqual({ max_objects: 50, ai_matching: true, push_notifications: true, priority_support: false, bulk_qr: false });
    });
    it(`conta Business ativa (${estado}): intacta`, async () => {
      if (estado === 'desligado') desligar();
      st.plano = 'business'; st.expira = null;
      const s = await status(); expect(s.plan).toBe('business'); expect(s.features.max_objects).toBe(500);
    });
  }
  it('free: 100 ligado, 3 desligado', async () => { expect((await status()).features.max_objects).toBe(100); desligar(); expect((await status()).features.max_objects).toBe(3); });
});

describe('GET /api/v1/plans (página de preços): plan_configs NÃO é alterado; o interruptor decide o que aparece', () => {
  const BANCO = [
    { slug: 'free', name: 'Grátis', price_brl: '0.00', max_objects: 3, features: ['3 objetos', 'QR Code permanente', 'Busca manual', 'Suporte comunidade'], is_active: true, stripe_price_id: null, mp_plan_id: null },
    { slug: 'pro', name: 'Pro', price_brl: '29.00', max_objects: 50, features: ['50 objetos', 'Matching automático'], is_active: true, stripe_price_id: null, mp_plan_id: null },
    { slug: 'business', name: 'Business', price_brl: '149.00', max_objects: 500, features: ['500 objetos'], is_active: true, stripe_price_id: null, mp_plan_id: null },
  ];
  const planos = async () => { const res = await getPlans(new NextRequest('http://localhost/api/v1/plans')); const b = await res.json(); return (b?.data ?? b) as { plans: typeof BANCO; modo_crescimento: boolean }; };
  it('LIGADO: só o grátis aparece (Pro e Business escondidos), com o texto de crescimento', async () => {
    st.planConfigs = BANCO; const p = await planos();
    expect(p.plans.map((x) => x.slug)).toEqual(['free']); expect(p.modo_crescimento).toBe(true);
    expect(p.plans[0].features).toEqual([...TEXTOS_CRESCIMENTO.free.features]); expect(JSON.stringify(p)).not.toMatch(/Pro\b|Business|50 objetos|3 objetos/);
  });
  it('DESLIGADO: os 3 planos EXATAMENTE como o banco (idêntico a antes)', async () => {
    desligar(); st.planConfigs = BANCO; const p = await planos();
    expect(p.plans).toEqual(BANCO); expect(p.modo_crescimento).toBe(false);
  });
  it('nenhum UPDATE/INSERT em plan_configs (o interruptor dispensa o UPDATE)', async () => {
    st.planConfigs = BANCO; await planos(); expect(st.sqls.some((q) => /UPDATE|INSERT/i.test(q))).toBe(false);
  });
});

describe('checkout de plano', () => {
  it('LIGADO: bloqueia as 3 portas de nova assinatura com mensagem clara (403), sem quebrar', async () => {
    const a = await postCheckout(req('/api/v1/checkout/mercadopago', { type: 'plan', plan_slug: 'pro' }));
    expect(a.status).toBe(403); expect((await a.json()).codigo).toBe('ASSINATURAS_PAUSADAS');
    const b = await postBilling(req('/api/v1/billing', { action: 'upgrade', plan_slug: 'pro' }));
    expect(b.status).toBe(403); expect(JSON.stringify(await b.json())).toContain('pausadas');
    const c = await postStripe(req('/api/stripe/checkout', { price_id: 'x' }));
    expect(c.status).toBe(403);
  });
  it('LIGADO: o Boost NÃO é bloqueado e cancelar plano continua funcionando (não responde ASSINATURAS_PAUSADAS)', async () => {
    const a = await postCheckout(req('/api/v1/checkout/mercadopago', { type: 'boost', object_id: 'o1', boost_type: 'x' }));
    expect(JSON.stringify(await a.json().catch(() => ({})))).not.toContain('ASSINATURAS_PAUSADAS');
    const b = await postBilling(req('/api/v1/billing', { action: 'cancel' }));
    expect(b.status).not.toBe(403 as number);
  });
  it('DESLIGADO: o checkout de plano volta a seguir adiante (não é bloqueado pelo interruptor)', async () => {
    desligar();
    const a = await postCheckout(req('/api/v1/checkout/mercadopago', { type: 'plan', plan_slug: 'pro' }));
    expect(JSON.stringify(await a.json().catch(() => ({})))).not.toContain('ASSINATURAS_PAUSADAS');
    const b = await postBilling(req('/api/v1/billing', { action: 'upgrade', plan_slug: 'xyz' }));
    expect(b.status).toBe(400);
  });
});

describe('textos: FAQ e assistente', () => {
  const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
  it('DESLIGADO: FAQ = textos originais, sem nenhuma mudança (impressão digital + frases-chave)', () => {
    desligar(); const secs = secoesDoFaq();
    expect(secs).toEqual(SECTIONS_ORIGINAIS); expect(hash(secs)).toBe(hash(SECTIONS_ORIGINAIS));
    const t = JSON.stringify(secs); expect(t).toContain('até 3 objetos'); expect(t).toContain('o plano Pro permite até 20 registros'); expect(t).toContain('O plano Business aceita CNPJ?');
  });
  it('LIGADO: FAQ sem Pro/Business, sem «3 objetos» e sem «20 registros»; com «quantos precisar»', () => {
    const t = JSON.stringify(secoesDoFaq());
    expect(t).not.toMatch(/Business|plano Pro|\bPro\b|3 objetos|até 3 obj|20 registros|plano pago|upgrade/i); expect(t).toContain('quantos');
  });
  it('o texto original continua guardado no código (inativo): FAQ, preços e assistente', () => {
    expect(r('src/app/faq/client.tsx')).toContain('até 3 objetos'); expect(r('src/app/pricing/client.tsx')).toContain("'3 objetos cadastrados'");
    expect(r('src/app/pricing/client.tsx')).toContain("'50 objetos cadastrados'"); expect(r('src/components/AssistantWidget.tsx')).toContain('Até 3 objetos cadastrados');
    expect(r('src/components/AssistantWidget.tsx')).toContain('Até 50 objetos cadastrados'); expect(r('src/app/api/v1/assistant/chat/route.ts')).toContain('PLANO PRO (R$ 29/mês)');
  });
  const BASE = r('src/app/api/v1/assistant/chat/route.ts');
  const prompt = BASE.slice(BASE.indexOf('const BASE_SYSTEM_PROMPT'), BASE.indexOf('`;', BASE.indexOf('const BASE_SYSTEM_PROMPT')));
  it('chat de IA DESLIGADO: prompt idêntico ao de antes', () => { expect(promptDoModo(prompt, false)).toBe(prompt); expect(prompt).toContain('PLANO PRO (R$ 29/mês)'); expect(prompt).toContain('Até 3 objetos cadastrados'); });
  it('chat de IA LIGADO: só o plano grátis (sem limite prático) e o Boost; nada de Pro/Business', () => {
    const p = promptDoModo(prompt, true);
    expect(p).not.toMatch(/PLANO PRO|PLANO BUSINESS|R\$ 29|R\$ 149|Até 3 objetos|Até 50|Até 500|business@backfindr/); expect(p).toContain('Cadastre quantos objetos precisar'.slice(0, 11)); expect(p).toContain('BOOST — destaque avulso');
  });
});

describe('onde o interruptor está ligado ao código (guardas)', () => {
  it('as superfícies usam o interruptor único', () => {
    for (const f of ['src/app/pricing/client.tsx', 'src/app/pricing/page.tsx', 'src/app/dashboard/billing/page.tsx', 'src/app/dashboard/page.tsx', 'src/app/auth/register/page.tsx', 'src/app/dashboard/objects/new/page.tsx',
      'src/app/faq/client.tsx', 'src/components/AssistantWidget.tsx', 'src/app/api/v1/assistant/chat/route.ts', 'src/app/api/v1/plans/route.ts', 'src/app/api/v1/checkout/mercadopago/route.ts',
      'src/app/api/v1/billing/route.ts', 'src/app/api/stripe/checkout/route.ts', 'src/app/api/v1/objects/route.ts', 'src/lib/planos.ts']) expect(r(f), f).toContain('@/lib/modoCrescimento');
  });
  it('um único lugar lê a variável', () => {
    const lido = ['src', 'tests'].length; expect(lido).toBe(2);
    expect(r('src/lib/modoCrescimento.ts')).toContain("process.env.NEXT_PUBLIC_MODO_CRESCIMENTO !== '0'");
  });
  it('nenhum SQL/UPDATE de plan_configs no código novo; os scripts de UPDATE foram retirados', () => {
    expect(() => readFileSync(path.join(__dirname, '..', 'docs/planos/pl01-plan-configs-aplicar.sql'), 'utf8')).toThrow();
  });
});
