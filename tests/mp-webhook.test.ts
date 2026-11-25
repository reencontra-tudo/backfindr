// Webhook do Mercado Pago ENDURECIDO (24/11/2026): assinatura, idempotência, erro de verdade, estorno só registrado, dono do objeto.
// Parte A: sem banco (Mercado Pago simulado). Parte B: Postgres REAL (precisa de TEST_DATABASE_URL; senão é pulada) — prova a idempotência, inclusive em aviso duplicado SIMULTÂNEO.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assinar, assinaturaValida, partesDaAssinatura, textoAssinado } from '@/lib/mpAssinatura';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const mp = vi.hoisted(() => ({ resposta: null as unknown, erro: null as unknown, chamadas: 0 }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class { constructor(_: unknown) {} },
  Payment: class { async get() { mp.chamadas++; if (mp.erro) throw mp.erro; return mp.resposta; } },
  Preference: class { async create() { return { id: 'pref', init_point: 'https://x', sandbox_init_point: 'https://y' }; } },
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

import { POST } from '@/app/api/v1/webhooks/mercadopago/route';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['boosts', 'objects', 'subscriptions_p1', 'users'];

const SEGREDO = 'segredo-de-teste-nao-real';
const aviso = (corpo: unknown, headers: Record<string, string> = {}, qs = '') =>
  new NextRequest(`http://localhost/api/v1/webhooks/mercadopago${qs}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(corpo) });
/** Cabeçalhos assinados como o Mercado Pago faz: o `data.id` assinado é o da URL (null = sem `data.id` na URL, omitido do manifest). */
const assinado = (idDaUrl: string | null, rid: string | null = 'req-123') => {
  const ts = '1700000000';
  return { 'x-signature': `ts=${ts},v1=${assinar(textoAssinado(idDaUrl, rid, ts), SEGREDO)}`, ...(rid ? { 'x-request-id': rid } : {}) };
};
const lerStatus = async (res: Response) => ((await res.json()) as { status?: string; error?: string });

beforeEach(() => { delete process.env.MP_WEBHOOK_SECRET; process.env.MP_ACCESS_TOKEN = 'TEST-xyz'; mp.resposta = null; mp.erro = null; mp.chamadas = 0; });

// VETORES CONHECIDOS: gerados com o validador do SDK OFICIAL do Mercado Pago (`WebhookSignatureValidator`, mercadopago@3.6.2) e a mesma assinatura secreta de teste.
// «sdk» = o que o validador oficial respondeu para o par (cabeçalho, id, request-id).
const VETORES = [
  { nome: 'completo', dataId: '123456789', rid: 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e', ts: '1742505638', v1: 'eda250f461f9dd3bd3cd6fff8a578426356138442ef871008e1fdac482858272', sdk: true },
  { nome: 'sem request-id (par omitido)', dataId: '123456789', rid: null, ts: '1742505638', v1: '7eee13bc502065aaf4d71f9b424dd8069b4ac145e7ef7a0dc83a440099c1b7e6', sdk: true },
  { nome: 'sem data.id (par omitido)', dataId: null, rid: 'req-1', ts: '1742505638', v1: 'b48d75525c816cf5857ded83d7df8df3df432088cb3258a0a237a5d7f83fbcaf', sdk: true },
  { nome: 'id alfanumérico assinado COMO VEIO', dataId: 'ABC123xyz', rid: 'req-2', ts: '1742505638', v1: '72be0aa6dfd8d7f64c539c25582575d2f15e3eb7be4c40b9b475a8d59ce607f0', sdk: true },
  { nome: 'id alfanumérico assinado em MINÚSCULO (o SDK oficial recusa; nós aceitamos de propósito)', dataId: 'ABC123xyz', rid: 'req-2', ts: '1742505638', v1: '3e0808ff2bce895e4b979c4b1362987a153c96e1fbc2bd29ccfe32a003b34902', sdk: false },
];

describe('A1. assinatura (funções puras; vetores do SDK oficial)', () => {
  it('lê ts e v1 como o SDK (vírgulas, espaços, chaves sem diferenciar maiúscula, chaves desconhecidas ignoradas)', () => {
    expect(partesDaAssinatura('ts=123,v1=abc')).toEqual({ ts: '123', hashes: { v1: 'abc' } });
    expect(partesDaAssinatura(' TS = 9 , V1 = aa , v2=bb , x=1 , lixo ')).toEqual({ ts: '9', hashes: { v1: 'aa', v2: 'bb' } });
    expect(partesDaAssinatura(null)).toEqual({ ts: null, hashes: {} }); expect(partesDaAssinatura('   ')).toEqual({ ts: null, hashes: {} });
  });
  it('manifest: `id:..;request-id:..;ts:..;` com pares ausentes OMITIDOS e id SEM mudar de caixa', () => {
    expect(textoAssinado('123456789', 'r1', '99')).toBe('id:123456789;request-id:r1;ts:99;');
    expect(textoAssinado('ABC123xyz', 'r1', '99')).toBe('id:ABC123xyz;request-id:r1;ts:99;');
    expect(textoAssinado('12345', null, '99')).toBe('id:12345;ts:99;'); expect(textoAssinado(null, 'r1', '99')).toBe('request-id:r1;ts:99;');
    expect(textoAssinado('  ', '', '99')).toBe('ts:99;');
  });
  for (const v of VETORES) {
    it(`vetor do SDK oficial: ${v.nome}`, () => {
      const base = { xSignature: `ts=${v.ts},v1=${v.v1}`, xRequestId: v.rid, dataId: v.dataId, segredo: SEGREDO };
      expect(assinar(textoAssinado(v.dataId, v.rid, v.ts), SEGREDO) === v.v1).toBe(v.sdk);   // o HMAC do manifest «como veio» bate com o do SDK
      expect(assinaturaValida(base)).toBe(true);                                              // nunca rejeitamos o que o SDK aceita (e aceitamos também o minúsculo)
      expect(assinaturaValida({ ...base, segredo: 'outro-segredo' })).toBe(false);
    });
  }
  it('rejeita: segredo vazio, sem ts, ts não numérico, sem v1, id/request-id/ts trocados, hash adulterado', () => {
    const v = VETORES[0]; const ok = { xSignature: `ts=${v.ts},v1=${v.v1}`, xRequestId: v.rid, dataId: v.dataId, segredo: SEGREDO };
    expect(assinaturaValida(ok)).toBe(true);
    expect(assinaturaValida({ ...ok, segredo: '' })).toBe(false); expect(assinaturaValida({ ...ok, xSignature: `v1=${v.v1}` })).toBe(false);
    expect(assinaturaValida({ ...ok, xSignature: `ts=abc,v1=${v.v1}` })).toBe(false); expect(assinaturaValida({ ...ok, xSignature: `ts=${v.ts}` })).toBe(false);
    expect(assinaturaValida({ ...ok, xSignature: null })).toBe(false); expect(assinaturaValida({ ...ok, dataId: '123456780' })).toBe(false);
    expect(assinaturaValida({ ...ok, xRequestId: 'outro' })).toBe(false); expect(assinaturaValida({ ...ok, xSignature: `ts=${Number(v.ts) + 1},v1=${v.v1}` })).toBe(false);
    expect(assinaturaValida({ ...ok, xSignature: `ts=${v.ts},v1=${v.v1.slice(0, -1)}0` })).toBe(false); expect(assinaturaValida({ ...ok, xSignature: `ts=${v.ts},v1=${v.v1.slice(0, 10)}` })).toBe(false);
  });
});

describe('A2. rota: assinatura (data.id vem da URL, nunca do corpo)', () => {
  it('COM segredo: sem assinatura = 401 e o Mercado Pago nem é consultado', async () => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
    const res = await POST(aviso({ type: 'payment', data: { id: '55' } }, {}, '?data.id=55'));
    expect(res.status).toBe(401); expect(mp.chamadas).toBe(0);
  });
  it('COM segredo: assinatura inválida = 401; boa, com o id na URL, passa', async () => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO;
    expect((await POST(aviso({ type: 'payment', data: { id: '55' } }, { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'r' }, '?data.id=55'))).status).toBe(401);
    mp.resposta = { status: 'pending' };
    const ok = await POST(aviso({ type: 'payment', data: { id: '55' } }, assinado('55'), '?data.id=55'));
    expect(ok.status).toBe(200); expect((await lerStatus(ok)).status).toBe('not_approved');
  });
  it('o id do CORPO não vale para a assinatura: assinada com o id do corpo mas sem `?data.id=` na URL = 401; assinada sem id (par omitido) passa', async () => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO; mp.resposta = { status: 'pending' };
    expect((await POST(aviso({ type: 'payment', data: { id: '55' } }, assinado('55')))).status).toBe(401);
    expect((await POST(aviso({ type: 'payment', data: { id: '55' } }, assinado(null)))).status).toBe(200);
    expect((await POST(aviso({ type: 'payment', data: { id: '999' } }, assinado('55'), '?data.id=55'))).status).toBe(200);   // vale o id da URL, não o do corpo
  });
  it('sem x-request-id (par omitido) também passa; id da URL trocado = 401', async () => {
    process.env.MP_WEBHOOK_SECRET = SEGREDO; mp.resposta = { status: 'pending' };
    expect((await POST(aviso({ type: 'payment', data: { id: '55' } }, assinado('55', null), '?data.id=55'))).status).toBe(200);
    expect((await POST(aviso({ type: 'payment', data: { id: '55' } }, assinado('55'), '?data.id=56'))).status).toBe(401);
  });
  it('SEM segredo: segue como antes (não derruba pagamentos); só avisa no log', async () => {
    mp.resposta = { status: 'pending' };
    expect((await POST(aviso({ type: 'payment', data: { id: '1' } }))).status).toBe(200);
  });
});

describe('A3. rota: erro de verdade e casos permanentes', () => {
  it('tipo que não é pagamento: 200 ignorado; corpo inválido: 400; sem id: 400', async () => {
    expect((await lerStatus(await POST(aviso({ type: 'plan' })))).status).toBe('ignored');
    expect((await POST(new NextRequest('http://localhost/x', { method: 'POST', body: 'não é json' }))).status).toBe(400);
    expect((await POST(aviso({ type: 'payment', data: {} }))).status).toBe(400);
  });
  it('pagamento inexistente no MP (404): 200 permanente; falha de rede/MP: 500 (o MP reenvia)', async () => {
    mp.erro = { status: 404 }; expect((await lerStatus(await POST(aviso({ type: 'payment', data: { id: '9' } })))).status).toBe('payment_not_found');
    mp.erro = new Error('ECONNRESET'); expect((await POST(aviso({ type: 'payment', data: { id: '9' } }))).status).toBe(500);
    mp.erro = { status: 503 }; expect((await POST(aviso({ type: 'payment', data: { id: '9' } }))).status).toBe(500);
  });
  it('sem MP_ACCESS_TOKEN: 500 (erro de configuração não vira 200)', async () => {
    delete process.env.MP_ACCESS_TOKEN; expect((await POST(aviso({ type: 'payment', data: { id: '9' } }))).status).toBe(500);
  });
  it('estorno, cancelamento e contestação: só registrados (200), sem tocar no banco; não aprovado e sem metadados: 200', async () => {
    for (const s of ['refunded', 'cancelled', 'charged_back']) { mp.resposta = { status: s }; expect((await lerStatus(await POST(aviso({ type: 'payment', data: { id: '9' } })))).status).toBe('refund_noted'); }
    for (const s of ['pending', 'in_process', 'rejected']) { mp.resposta = { status: s }; expect((await lerStatus(await POST(aviso({ type: 'payment', data: { id: '9' } })))).status).toBe('not_approved'); }
    mp.resposta = { status: 'approved' }; expect((await lerStatus(await POST(aviso({ type: 'payment', data: { id: '9' } })))).status).toBe('no_metadata');
  });
});

describe.skipIf(!TEST_DB)('B. com Postgres real: idempotência e dono do objeto', () => {
  let pool: Pool;
  const U1 = randomUUID(); const U2 = randomUUID(); const O1 = randomUUID(); const O2 = randomUUID();
  const aprovado = (id: string, metadata: Record<string, string>, valor = 9.9) => { mp.resposta = { status: 'approved', transaction_amount: valor, metadata }; return POST(aviso({ type: 'payment', data: { id } })); };
  const contar = async (sql: string, p: unknown[] = []) => Number((await pool.query(sql, p)).rows[0].n);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS boosts, subscriptions_p1, objects, users CASCADE');
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, plan text, plan_expires_at timestamptz, mp_subscription_id text, subscription_provider text, updated_at timestamptz)`);
    await pool.query(`CREATE TABLE objects (id uuid PRIMARY KEY, user_id uuid, status text DEFAULT 'lost', is_boosted boolean DEFAULT false, boost_expires_at timestamptz, updated_at timestamptz)`);
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid, user_id uuid, type text, status text, amount_paid numeric, provider text, provider_ref text, starts_at timestamptz, expires_at timestamptz, created_at timestamptz)`);
    await pool.query(`CREATE TABLE subscriptions_p1 (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, plan_slug text, provider text, provider_sub_id text, status text, amount_brl numeric, started_at timestamptz, expires_at timestamptz, created_at timestamptz)`);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE boosts, subscriptions_p1, objects, users');
    await pool.query(`INSERT INTO users (id, plan) VALUES ($1,'free'), ($2,'free')`, [U1, U2]);
    await pool.query(`INSERT INTO objects (id, user_id) VALUES ($1,$2), ($3,$4)`, [O1, U1, O2, U2]);
  });
  afterAll(async () => { await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  it('boost aprovado: ativa uma vez (boost + objeto)', async () => {
    const r = await aprovado('100', { type: 'boost', boost_type: 'boost_7', object_id: O1, user_id: U1, days: '7' });
    expect((await lerStatus(r)).status).toBe('processed');
    expect(await contar("SELECT count(*) n FROM boosts WHERE provider_ref = '100'")).toBe(1);
    expect(await contar('SELECT count(*) n FROM objects WHERE id = $1 AND is_boosted', [O1])).toBe(1);
  });
  it('o MESMO aviso de novo: já processado, nada duplica', async () => {
    const meta = { type: 'boost', boost_type: 'boost_7', object_id: O1, user_id: U1, days: '7' };
    await aprovado('101', meta);
    expect((await lerStatus(await aprovado('101', meta))).status).toBe('already_processed');
    expect(await contar("SELECT count(*) n FROM boosts WHERE provider_ref = '101'")).toBe(1);
  });
  it('dois avisos SIMULTÂNEOS do mesmo pagamento: exatamente 1 boost', async () => {
    const meta = { type: 'boost', boost_type: 'boost_7', object_id: O1, user_id: U1, days: '7' };
    const resp = await Promise.all([aprovado('102', meta), aprovado('102', meta), aprovado('102', meta)]);
    const s = await Promise.all(resp.map(lerStatus));
    expect(s.filter((x) => x.status === 'processed').length).toBe(1); expect(s.filter((x) => x.status === 'already_processed').length).toBe(2);
    expect(await contar("SELECT count(*) n FROM boosts WHERE provider_ref = '102'")).toBe(1);
  });
  it('plano aprovado: ativa uma vez; repetição não duplica a assinatura nem mexe de novo', async () => {
    const meta = { type: 'plan', plan_slug: 'pro', user_id: U1 };
    expect((await lerStatus(await aprovado('200', meta, 29.9))).status).toBe('processed');
    expect((await lerStatus(await aprovado('200', meta, 29.9))).status).toBe('already_processed');
    expect(await contar("SELECT count(*) n FROM subscriptions_p1 WHERE provider_sub_id = 'mp_200'")).toBe(1);
    expect(await contar("SELECT count(*) n FROM users WHERE id = $1 AND plan = 'pro'", [U1])).toBe(1);
  });
  it('dono divergente (objeto de outra pessoa) e dados inválidos: NÃO ativam nada (200 permanente, vai para análise)', async () => {
    expect((await lerStatus(await aprovado('300', { type: 'boost', boost_type: 'boost_7', object_id: O2, user_id: U1, days: '7' }))).status).toBe('owner_mismatch');
    expect((await lerStatus(await aprovado('301', { type: 'boost', boost_type: 'boost_7', object_id: 'não-é-uuid', user_id: U1 }))).status).toBe('invalid_boost_metadata');
    expect((await lerStatus(await aprovado('302', { type: 'boost', boost_type: 'boost_7', object_id: O1, user_id: 'anonymous' }))).status).toBe('invalid_boost_metadata');
    expect((await lerStatus(await aprovado('303', { type: 'plan', plan_slug: 'xyz', user_id: U1 }))).status).toBe('invalid_plan_metadata');
    expect((await lerStatus(await aprovado('304', { type: 'plan', plan_slug: 'pro', user_id: 'anonymous' }))).status).toBe('invalid_plan_metadata');
    expect(await contar('SELECT count(*) n FROM boosts')).toBe(0); expect(await contar('SELECT count(*) n FROM subscriptions_p1')).toBe(0);
    expect(await contar("SELECT count(*) n FROM users WHERE plan <> 'free'")).toBe(0); expect(await contar('SELECT count(*) n FROM objects WHERE is_boosted')).toBe(0);
  });
  it('falha de banco no meio: 500 e NADA fica pela metade (transação)', async () => {
    await pool.query('ALTER TABLE boosts RENAME TO boosts_x');
    const r = await aprovado('400', { type: 'boost', boost_type: 'boost_7', object_id: O1, user_id: U1, days: '7' });
    await pool.query('ALTER TABLE boosts_x RENAME TO boosts');
    expect(r.status).toBe(500); expect(await contar('SELECT count(*) n FROM objects WHERE is_boosted')).toBe(0);
  });
  it('usuário inexistente no pagamento de plano: nada gravado', async () => {
    const r = await aprovado('500', { type: 'plan', plan_slug: 'pro', user_id: randomUUID() });
    expect((await lerStatus(r)).status).toBe('user_not_found'); expect(await contar('SELECT count(*) n FROM subscriptions_p1')).toBe(0);
  });
});
