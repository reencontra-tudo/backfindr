// PROVA do webhook do Mercado Pago (pedido do fundador, 25/11/2026): 4 casos, status e corpo de cada. Mercado Pago SIMULADO (sem chamada externa); segredo de TESTE.
// Caso 4 usa Postgres local (TEST_DATABASE_URL). Os resultados são gravados em PROVA_SAIDA (se definida) para o relatório.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { assinar, textoAssinado } from '@/lib/mpAssinatura';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const mp = vi.hoisted(() => ({ resposta: null as unknown, chamadas: 0 }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class { constructor(_: unknown) {} },
  Payment: class { async get() { mp.chamadas++; return mp.resposta; } },
  Preference: class { async create() { return { id: 'pref', init_point: 'https://x', sandbox_init_point: 'https://y' }; } },
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {});
import { POST } from '@/app/api/v1/webhooks/mercadopago/route';

const SEGREDO = 'segredo-de-teste-nao-real'; const TS = '1700000000'; const RID = 'req-prova-1';
const saida: Record<string, unknown> = {};
const req = (corpo: unknown, headers: Record<string, string>, dataId: string) =>
  new NextRequest(`http://localhost/api/v1/webhooks/mercadopago?data.id=${dataId}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(corpo) });
const validos = (dataId: string) => ({ 'x-signature': `ts=${TS},v1=${assinar(textoAssinado(dataId, RID, TS), SEGREDO)}`, 'x-request-id': RID });
const ler = async (r: Response) => ({ status: r.status, corpo: await r.json() });

beforeEach(() => { process.env.MP_WEBHOOK_SECRET = SEGREDO; process.env.MP_ACCESS_TOKEN = 'TEST-xyz'; delete process.env.COLABORADORES_ATIVO; delete process.env.COMISSAO_SOMBRA; mp.resposta = null; mp.chamadas = 0; });
afterAll(() => { if (process.env.PROVA_SAIDA) writeFileSync(process.env.PROVA_SAIDA, JSON.stringify(saida, null, 2)); });

describe('casos 1 a 3: assinatura (type "order", id 123456)', () => {
  const corpo = { type: 'order', action: 'order.updated', data: { id: '123456' } };
  it('1) assinatura VÁLIDA + type order → 200 {status: ignored}, sem consultar o Mercado Pago', async () => {
    const r = await ler(await POST(req(corpo, validos('123456'), '123456'))); saida.caso1 = r;
    expect(r).toEqual({ status: 200, corpo: { status: 'ignored' } }); expect(mp.chamadas).toBe(0);
  });
  it('2) mesma requisição com assinatura ADULTERADA → 401 {error: Assinatura inválida}', async () => {
    const h = validos('123456'); h['x-signature'] = h['x-signature'].replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    const r = await ler(await POST(req(corpo, h, '123456'))); saida.caso2 = r;
    expect(r).toEqual({ status: 401, corpo: { error: 'Assinatura inválida' } }); expect(mp.chamadas).toBe(0);
  });
  it('3) SEM x-signature → 401 {error: Assinatura inválida}', async () => {
    const r = await ler(await POST(req(corpo, { 'x-request-id': RID }, '123456'))); saida.caso3 = r;
    expect(r).toEqual({ status: 401, corpo: { error: 'Assinatura inválida' } }); expect(mp.chamadas).toBe(0);
  });
});

describe.skipIf(!TEST_DB)('caso 4: payment aprovado, assinatura válida, COMISSAO_SOMBRA=1, banco local', () => {
  let pool: Pool; const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);
  const MIG = (n: string) => readFileSync(path.join(__dirname, `../src/db/migrations/${n}`), 'utf8');
  const U1 = randomUUID(); const DONO = randomUUID(); const CUSER = randomUUID(); const CID = randomUUID(); const OBJ = randomUUID();
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS colaborador_sinais, colaborador_visitas_dia, auditoria, colaborador_saques, colaborador_dados_pagamento, colaborador_lancamentos, pagamento_eventos, programa_config, colaborador_verificacoes, politica_aceites, boosts, subscriptions_p1, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY, email varchar, plan text, plan_expires_at timestamptz, mp_subscription_id text, subscription_provider text, updated_at timestamptz, created_at timestamptz DEFAULT now())');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY, user_id uuid, title text, status text DEFAULT 'lost', is_boosted boolean DEFAULT false, boost_expires_at timestamptz, updated_at timestamptz, created_at timestamp DEFAULT now())");
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL, type varchar NOT NULL, status varchar NOT NULL, amount_paid numeric, provider varchar, provider_ref varchar, starts_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, active boolean NOT NULL DEFAULT true)`);
    for (const m of ['026_colaboradores.sql', '027_colaboradores_inscricao.sql', '028_colaboradores_comissao.sql', '029_colaboradores_saque.sql', '030_colaboradores_auditoria.sql', '031_colaboradores_antifraude_visitas.sql']) await pool.query(MIG(m));
    await pool.query('INSERT INTO users (id, email, plan) VALUES ($1,$2,$3), ($4,$5,$3), ($6,$7,$3)', [U1, 'comprador@ex.com', 'free', DONO, 'dono@ex.com', CUSER, 'colab@ex.com']);
    await pool.query(`INSERT INTO colaboradores (id, user_id, slug, codigo_curto, nome, estado, interno, verificado_em) VALUES ($1,$2,'prova-colab','PRVA','Colab','ativo',FALSE, now())`, [CID, CUSER]);
    await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo) VALUES ($1,$2,'x',$3,'@prova-colab')`, [OBJ, U1, CID]);   // o comprador (metadata.user_id) é o DONO do objeto, como no checkout real
  });
  afterAll(async () => { await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  it('grava UMA linha de comissão no livro; repetir o mesmo pagamento (assinado) não duplica', async () => {
    process.env.COLABORADORES_ATIVO = '1'; process.env.COMISSAO_SOMBRA = '1';
    mp.resposta = { status: 'approved', transaction_amount: 9.9, metadata: { type: 'boost', boost_type: 'boost_7', object_id: OBJ, user_id: U1, days: '7' } };
    const corpo = { type: 'payment', action: 'payment.updated', data: { id: '777001' } };
    const r1 = await ler(await POST(req(corpo, validos('777001'), '777001')));
    const linhas1 = await q(`SELECT tipo, valor_centavos, base_centavos, percentual_aplicado, pagamento_ref FROM colaborador_lancamentos`);
    const r2 = await ler(await POST(req(corpo, validos('777001'), '777001')));
    const linhas2 = await q(`SELECT tipo, valor_centavos, pagamento_ref FROM colaborador_lancamentos`);
    const evt = await q('SELECT count(*)::int n FROM pagamento_eventos WHERE pagamento_id = $1', ['777001']);
    const boosts = await q(`SELECT count(*)::int n FROM boosts WHERE provider_ref = '777001'`);
    saida.caso4 = { primeira: r1, apos_primeira: linhas1, repeticao: r2, apos_repeticao: linhas2, boosts: boosts[0].n, eventos: evt[0].n };
    expect(r1).toEqual({ status: 200, corpo: { status: 'processed' } }); expect(linhas1).toHaveLength(1);
    expect(linhas1[0]).toMatchObject({ tipo: 'comissao', valor_centavos: 247, base_centavos: 990, pagamento_ref: '777001' });
    expect(r2).toEqual({ status: 200, corpo: { status: 'already_processed' } }); expect(linhas2).toHaveLength(1); expect(boosts[0].n).toBe(1);
  });
  it('contraprova: com COMISSAO_SOMBRA desligado o mesmo pagamento NÃO grava no livro', async () => {
    delete process.env.COMISSAO_SOMBRA; process.env.COLABORADORES_ATIVO = '1';
    const outro = randomUUID(); await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo) VALUES ($1,$2,'y',$3,'@prova-colab')`, [outro, U1, CID]);
    mp.resposta = { status: 'approved', transaction_amount: 9.9, metadata: { type: 'boost', boost_type: 'boost_7', object_id: outro, user_id: U1, days: '7' } };
    const antes = (await q('SELECT count(*)::int n FROM colaborador_lancamentos'))[0].n;
    const r = await ler(await POST(req({ type: 'payment', data: { id: '777002' } }, validos('777002'), '777002')));
    expect(r.status).toBe(200); expect((await q('SELECT count(*)::int n FROM colaborador_lancamentos'))[0].n).toBe(antes);
  });
});
