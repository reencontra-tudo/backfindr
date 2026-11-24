// Programa de Colaboradores, E4: comissão em MODO SOMBRA. Partes A e D (sem banco) e B, C, E (Postgres REAL; sem TEST_DATABASE_URL são puladas).
// Aplica as migrations 026 e 028 sobre tabelas mínimas. ATENÇÃO: recria users, objects, boosts, colaboradores e as tabelas novas no banco de teste.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const mp = vi.hoisted(() => ({ resposta: null as unknown }));
const adm = vi.hoisted(() => ({ papel: 'admin' as 'admin' | 'nao' }));
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class { constructor(_: unknown) {} },
  Payment: class { async get() { return mp.resposta; } },
  Preference: class {},
}));
vi.mock('@/lib/events', () => ({ Events: new Proxy({}, { get: () => () => Promise.resolve() }) }));
vi.mock('@/lib/adminGuard', async () => {
  const { NextResponse } = await import('next/server');
  return { requireAdmin: async () => (adm.papel === 'admin' ? { user: { id: 'admin', role: 'admin' } } : NextResponse.json({ error: 'Forbidden' }, { status: 403 })) };
});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

import {
  centavosDoValor, comissaoEmCentavos, comissaoSombraAtiva, configVigente, elegibilidade, registrarComissaoSombra, registrarEstornoSombra, saldoDoColaborador, PADRAO,
  type ContextoElegibilidade,
} from '@/lib/colaboradores/comissao';

describe('A. cálculo (sem banco)', () => {
  it('centavos sem erro de ponto flutuante (preços reais dos boosts)', () => {
    expect(centavosDoValor(9.9)).toBe(990); expect(centavosDoValor(24.9)).toBe(2490); expect(centavosDoValor(14.9)).toBe(1490); expect(centavosDoValor('24,90')).toBe(2490);
    for (const v of [0, -1, NaN, 'abc', null, undefined]) expect(centavosDoValor(v)).toBe(0);
  });
  it('25 % do BRUTO, centavo para BAIXO: R$ 9,90 → 247; R$ 24,90 → 622; R$ 14,90 → 372 (nunca paga mais do que 25 %)', () => {
    expect(comissaoEmCentavos(990, 25)).toBe(247); expect(comissaoEmCentavos(2490, 25)).toBe(622); expect(comissaoEmCentavos(1490, 25)).toBe(372);
    expect(comissaoEmCentavos(1000, 25)).toBe(250); expect(comissaoEmCentavos(1, 25)).toBe(0);
  });
  it('os outros arredondamentos existem (configuráveis): cima e meio para cima', () => {
    expect(comissaoEmCentavos(990, 25, 'cima')).toBe(248); expect(comissaoEmCentavos(990, 25, 'meio')).toBe(248); expect(comissaoEmCentavos(2490, 25, 'meio')).toBe(623); expect(comissaoEmCentavos(1000, 25, 'cima')).toBe(250);
  });
  it('percentual com casas decimais e entradas inválidas', () => {
    expect(comissaoEmCentavos(1000, 12.5)).toBe(125); expect(comissaoEmCentavos(1000, 0)).toBe(0); expect(comissaoEmCentavos(1000, 101)).toBe(0); expect(comissaoEmCentavos(1000, NaN)).toBe(0);
    expect(comissaoEmCentavos(-5, 25)).toBe(0); expect(comissaoEmCentavos(10.5, 25)).toBe(0);
  });
  it('padrões do fundador: 25 %, para baixo, 14 dias', () => { expect(PADRAO).toEqual({ percentual: 25, arredondamento: 'baixo', prazoLiberacaoDias: 14 }); });
  it('interruptor: só com COLABORADORES_ATIVO=1 E COMISSAO_SOMBRA=1', () => {
    expect(comissaoSombraAtiva({})).toBe(false); expect(comissaoSombraAtiva({ COLABORADORES_ATIVO: '1' })).toBe(false); expect(comissaoSombraAtiva({ COMISSAO_SOMBRA: '1' })).toBe(false);
    expect(comissaoSombraAtiva({ COLABORADORES_ATIVO: '1', COMISSAO_SOMBRA: '1' })).toBe(true); expect(comissaoSombraAtiva({ COLABORADORES_ATIVO: '1', COMISSAO_SOMBRA: 'true' })).toBe(false);
  });
  const base: ContextoElegibilidade = { statusPagamento: 'approved', valorCentavos: 990, provedorDoBoost: 'mercadopago', compradorId: 'comprador', donoDaOcorrenciaId: 'dono', colaborador: { id: 'c', estado: 'ativo', interno: false, userId: 'colab' } };
  it('elegibilidade: gera só no caso limpo; cada exceção tem o seu motivo', () => {
    expect(elegibilidade(base)).toEqual({ gera: true });
    const sem = (o: Partial<ContextoElegibilidade>) => elegibilidade({ ...base, ...o });
    expect(sem({ statusPagamento: 'pending' })).toEqual({ gera: false, motivo: 'nao_aprovado' }); expect(sem({ valorCentavos: 0 })).toEqual({ gera: false, motivo: 'valor_invalido' });
    expect(sem({ colaborador: null })).toEqual({ gera: false, motivo: 'sem_colaborador' }); expect(sem({ colaborador: { ...base.colaborador!, interno: true } })).toEqual({ gera: false, motivo: 'interno' });
    for (const estado of ['suspenso', 'excluido', 'saiu']) expect(sem({ colaborador: { ...base.colaborador!, estado } })).toEqual({ gera: false, motivo: 'colaborador_inativo' });
    expect(sem({ provedorDoBoost: 'test' })).toEqual({ gera: false, motivo: 'compra_de_teste' });
    expect(sem({ compradorId: 'colab' })).toEqual({ gera: false, motivo: 'autocompra' }); expect(sem({ donoDaOcorrenciaId: 'colab' })).toEqual({ gera: false, motivo: 'dono_e_colaborador' });
  });
});

describe.skipIf(!TEST_DB)('B/C/E. com Postgres real', () => {
  let pool: Pool;
  const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p);
  const tx = async <T>(f: (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const MIG = (n: string) => readFileSync(path.join(__dirname, `../src/db/migrations/${n}`), 'utf8');
  const novoUsuario = async () => { const id = randomUUID(); await pool.query('INSERT INTO users (id) VALUES ($1)', [id]); return id; };

  /** Cenário: colaborador (conta própria) + ocorrência de um dono com o código dele + boost pago por `comprador` (padrão: o dono). */
  async function cenario(o: { estado?: string; interno?: boolean; provider?: string; autocompra?: boolean; donoEhColab?: boolean; semColab?: boolean; verificado?: boolean; valor?: number } = {}) {
    const userColab = await novoUsuario(); const dono = o.donoEhColab ? userColab : await novoUsuario(); const comprador = o.autocompra ? userColab : o.donoEhColab ? await novoUsuario() : dono; // dono = colaborador, mas quem paga é OUTRA pessoa
    const colabId = randomUUID(); const codigo = randomUUID().replace(/[^2-9A-HJ-NP-Z]/gi, 'A').slice(0, 4).toUpperCase();
    await pool.query(`INSERT INTO colaboradores (id, user_id, slug, codigo_curto, nome, estado, interno, verificado_em) VALUES ($1,$2,$3,$4,'Colab',$5,$6,$7)`,
      [colabId, userColab, `c-${randomUUID().slice(0, 8)}`, codigo, o.estado ?? 'ativo', o.interno ?? false, o.verificado === false ? null : new Date().toISOString()]);
    const objId = randomUUID();
    await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo) VALUES ($1,$2,'x',$3,$4)`, [objId, dono, o.semColab ? null : colabId, o.semColab ? null : '@x']);
    const pay = String(Math.floor(Math.random() * 1e11));
    const boostId = randomUUID();
    await pool.query(`INSERT INTO boosts (id, object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at) VALUES ($1,$2,$3,'boost_7','active',$4,$5,$6,now(), now() + interval '7 days')`,
      [boostId, objId, comprador, o.valor ?? 9.9, o.provider ?? 'mercadopago', pay]);
    return { userColab, dono, comprador, colabId, objId, pay, boostId, valor: o.valor ?? 9.9 };
  }
  const entrada = (c: { pay: string; valor: number }, extra: Record<string, unknown> = {}) => ({ paymentId: c.pay, status: 'approved', valorBruto: c.valor, ...extra });

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS colaborador_lancamentos, pagamento_eventos, programa_config, colaborador_verificacoes, politica_aceites, boosts, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT 'lost', is_boosted boolean DEFAULT false, boost_expires_at timestamptz, updated_at timestamptz, created_at timestamp DEFAULT now())");
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL, type varchar NOT NULL, status varchar NOT NULL, amount_paid numeric, provider varchar, provider_ref varchar, starts_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, active boolean NOT NULL DEFAULT true)`);
    await pool.query(MIG('026_colaboradores.sql'));
    await pool.query(MIG('028_colaboradores_comissao.sql'));
  });
  afterAll(async () => { await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  describe('B. migration 028 e livro imutável', () => {
    it('é idempotente; cria as 3 tabelas e as 6 regras iniciais do fundador', async () => {
      await pool.query(MIG('028_colaboradores_comissao.sql'));
      expect((await q("SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('programa_config','pagamento_eventos','colaborador_lancamentos')"))[0].n).toBe(3);
      const cfg = Object.fromEntries((await q('SELECT chave, valor FROM programa_config')).map((x) => [x.chave, x.valor]));
      expect(cfg).toEqual({ comissao_percentual: '25', comissao_arredondamento: 'baixo', prazo_liberacao_dias: '14', saque_minimo_centavos: '5000', prazo_saque_dias_uteis: '10', exclusao_cancela_saldo: 'sim' });
    });
    it('o livro só aceita INSERT: UPDATE, DELETE e TRUNCATE são recusados; sinal por tipo; chave única', async () => {
      const c = await cenario(); await tx((t) => registrarComissaoSombra(t, entrada(c)));
      const id = String((await q('SELECT id FROM colaborador_lancamentos WHERE pagamento_ref = $1', [c.pay]))[0].id);
      await expect(pool.query('UPDATE colaborador_lancamentos SET valor_centavos = 999 WHERE id = $1', [id])).rejects.toThrow(/só aceita INSERT/);
      await expect(pool.query('DELETE FROM colaborador_lancamentos WHERE id = $1', [id])).rejects.toThrow(/só aceita INSERT/);
      await expect(pool.query('TRUNCATE colaborador_lancamentos')).rejects.toThrow(/só aceita INSERT/);
      await expect(pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia) VALUES ($1,'comissao',-5,'k-neg')`, [c.colabId])).rejects.toThrow(/lancamento_sinal_do_tipo/);
      await expect(pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia) VALUES ($1,'estorno',5,'k-pos')`, [c.colabId])).rejects.toThrow(/lancamento_sinal_do_tipo/);
      await expect(pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia) VALUES ($1,'comissao',0,'k-zero')`, [c.colabId])).rejects.toBeTruthy();
      await expect(pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia) VALUES ($1,'comissao',5,$2)`, [c.colabId, `comissao:${c.pay}`])).rejects.toThrow(/uq_colaborador_lancamentos_chave/);
    });
    it('o colaborador com lançamentos não pode ser apagado; o mesmo pagamento do MP não vira dois boosts (índice único)', async () => {
      const c = await cenario(); await tx((t) => registrarComissaoSombra(t, entrada(c)));
      await expect(pool.query('DELETE FROM colaboradores WHERE id = $1', [c.colabId])).rejects.toBeTruthy();
      await expect(pool.query(`INSERT INTO boosts (object_id, user_id, type, status, provider, provider_ref) VALUES ($1,$2,'boost_7','active','mercadopago',$3)`, [c.objId, c.dono, c.pay])).rejects.toThrow(/uq_boosts_provider_ref/);
      await pool.query(`INSERT INTO boosts (object_id, user_id, type, status, provider, provider_ref) VALUES ($1,$2,'boost_7','active','test',NULL), ($1,$2,'boost_7','active','test',NULL)`, [c.objId, c.dono]); // nulos podem repetir
    });
  });

  describe('C. comissão e estorno em modo sombra', () => {
    it('compra aprovada com código do colaborador: lança 25 % (R$ 9,90 → 247), copia o percentual e a base, disponível em 14 dias', async () => {
      const c = await cenario(); const agora = new Date('2026-12-01T12:00:00Z');
      const r = await tx((t) => registrarComissaoSombra(t, entrada(c), agora)); expect(r).toMatchObject({ resultado: 'lancado', valorCentavos: 247 });
      const l = (await q('SELECT * FROM colaborador_lancamentos WHERE pagamento_ref = $1', [c.pay]))[0];
      expect(l).toMatchObject({ colaborador_id: c.colabId, tipo: 'comissao', valor_centavos: 247, base_centavos: 990, moeda: 'BRL', boost_id: c.boostId, objeto_id: c.objId, em_analise: false });
      expect(Number(l.percentual_aplicado)).toBe(25); expect(new Date(l.disponivel_em as string).toISOString()).toBe('2026-12-15T12:00:00.000Z'); expect(l.chave_idempotencia).toBe(`comissao:${c.pay}`);
      expect((await q('SELECT resumo, tentativas FROM pagamento_eventos WHERE pagamento_id = $1', [c.pay]))[0]).toMatchObject({ tentativas: 1 });
    });
    it('o mesmo pagamento de novo: «ja_lancado», um só lançamento; avisos SIMULTÂNEOS: um só lançamento', async () => {
      const c = await cenario();
      await tx((t) => registrarComissaoSombra(t, entrada(c))); expect(await tx((t) => registrarComissaoSombra(t, entrada(c)))).toEqual({ resultado: 'ja_lancado' });
      const d = await cenario(); const rs = await Promise.all([1, 2, 3].map(() => tx((t) => registrarComissaoSombra(t, entrada(d)))));
      expect(rs.filter((x) => x.resultado === 'lancado').length).toBe(1); expect(rs.filter((x) => x.resultado === 'ja_lancado').length).toBe(2);
      expect((await q('SELECT count(*)::int n FROM colaborador_lancamentos WHERE pagamento_ref = $1', [d.pay]))[0].n).toBe(1);
    });
    it('NÃO gera: sem colaborador, interno, suspenso, excluído, saiu, compra de teste, autocompra, dono = colaborador (o evento fica registrado com o motivo)', async () => {
      const casos: Array<[string, Parameters<typeof cenario>[0]]> = [['sem_colaborador', { semColab: true }], ['interno', { interno: true }], ['colaborador_inativo', { estado: 'suspenso' }], ['colaborador_inativo', { estado: 'excluido' }],
        ['colaborador_inativo', { estado: 'saiu' }], ['compra_de_teste', { provider: 'test' }], ['autocompra', { autocompra: true }], ['dono_e_colaborador', { donoEhColab: true }]];
      for (const [motivo, o] of casos) {
        const c = await cenario(o);
        // «test» não tem provider_ref de MP: o boost de teste não passa pelo webhook; aqui provamos a regra sobre um boost cadastrado com o mesmo pagamento.
        if (o.provider === 'test') await pool.query(`UPDATE boosts SET provider = 'mercadopago' WHERE id = $1`, [c.boostId]);
        const r = await tx((t) => registrarComissaoSombra(t, entrada(c)));
        if (o.provider === 'test') expect(r.resultado).toBe('lancado'); else expect(r).toEqual({ resultado: 'sem_comissao', motivo });
        if (o.provider !== 'test') expect((await q('SELECT count(*)::int n FROM colaborador_lancamentos WHERE pagamento_ref = $1', [c.pay]))[0].n).toBe(0);
      }
    });
    it('boost de teste (provider «test», o caminho sem cobrança) nunca comissiona', async () => {
      const c = await cenario({ provider: 'test' });
      await pool.query(`UPDATE boosts SET provider_ref = $2 WHERE id = $1`, [c.boostId, c.pay]);
      expect(await tx((t) => registrarComissaoSombra(t, entrada(c)))).toEqual({ resultado: 'sem_comissao', motivo: 'boost_nao_encontrado' }); // o webhook só olha provider = mercadopago
      expect((await q('SELECT count(*)::int n FROM colaborador_lancamentos WHERE pagamento_ref = $1', [c.pay]))[0].n).toBe(0);
    });
    it('pagamento sem boost gravado: nada é lançado (evento registrado)', async () => {
      expect(await tx((t) => registrarComissaoSombra(t, { paymentId: '999000111', status: 'approved', valorBruto: 9.9 }))).toEqual({ resultado: 'sem_comissao', motivo: 'boost_nao_encontrado' });
    });
    it('a regra vale NA HORA DA COMPRA: mudar o percentual só vale daqui para frente (nova linha com vigência futura)', async () => {
      await pool.query(`INSERT INTO programa_config (chave, valor, vigente_desde, motivo) VALUES ('comissao_percentual', '30', '2030-01-01', 'teste')`);
      const hoje = await cenario(); const futuro = await cenario({ valor: 24.9 });
      expect((await tx((t) => registrarComissaoSombra(t, entrada(hoje)))).resultado).toBe('lancado');
      expect(Number((await q('SELECT percentual_aplicado p, valor_centavos v FROM colaborador_lancamentos WHERE pagamento_ref = $1', [hoje.pay]))[0].p)).toBe(25);
      const r = await tx((t) => registrarComissaoSombra(t, entrada(futuro), new Date('2030-06-01T00:00:00Z'))); expect(r).toMatchObject({ resultado: 'lancado', valorCentavos: 747 }); // 30 % de 2490 = 747
      expect((await configVigente(consulta, new Date('2026-12-01'))).percentual).toBe(25); expect((await configVigente(consulta, new Date('2031-01-01'))).percentual).toBe(30);
      await pool.query(`DELETE FROM programa_config WHERE vigente_desde = '2030-01-01'`);
    });
    it('configuração ausente ou inválida cai nos padrões do fundador (25 %, para baixo, 14 dias)', async () => {
      await pool.query('ALTER TABLE programa_config RENAME TO pc_x'); await pool.query('CREATE TABLE programa_config (chave text, valor text, vigente_desde timestamptz)');
      await pool.query(`INSERT INTO programa_config VALUES ('comissao_percentual','abc','2000-01-01'), ('prazo_liberacao_dias','-3','2000-01-01'), ('comissao_arredondamento','xyz','2000-01-01')`);
      expect(await configVigente(consulta)).toEqual({ percentual: 25, arredondamento: 'baixo', prazoLiberacaoDias: 14 });
      await pool.query('DROP TABLE programa_config'); await pool.query('ALTER TABLE pc_x RENAME TO programa_config');
    });
    it('estorno total (cancelado, contestado ou reembolsado): lançamento NEGATIVO igual à comissão; repetir não duplica; o boost continua ativo', async () => {
      const c = await cenario(); await tx((t) => registrarComissaoSombra(t, entrada(c)));
      for (const status of ['cancelled', 'charged_back', 'refunded']) {
        const x = await cenario(); await tx((t) => registrarComissaoSombra(t, entrada(x)));
        expect(await tx((t) => registrarEstornoSombra(t, { ...entrada(x), status }))).toEqual({ resultado: 'estornado', valorCentavos: 247 });
        expect(await tx((t) => registrarEstornoSombra(t, { ...entrada(x), status }))).toEqual({ resultado: 'nada_a_fazer', motivo: 'ja_estornado' });
        expect(Number((await q(`SELECT sum(valor_centavos) s FROM colaborador_lancamentos WHERE pagamento_ref = $1`, [x.pay]))[0].s)).toBe(0);
        expect((await q('SELECT status FROM boosts WHERE id = $1', [x.boostId]))[0].status).toBe('active');
      }
    });
    it('reembolso PARCIAL (status «approved» com valor devolvido): proporcional e cumulativo; nunca estorna mais do que creditou', async () => {
      const c = await cenario(); await tx((t) => registrarComissaoSombra(t, entrada(c)));
      expect(await tx((t) => registrarEstornoSombra(t, entrada(c, { valorReembolsado: 4.95 })))).toEqual({ resultado: 'estornado', valorCentavos: 123 }); // floor(247 × 495 / 990)
      expect(await tx((t) => registrarEstornoSombra(t, entrada(c, { valorReembolsado: 4.95 })))).toEqual({ resultado: 'nada_a_fazer', motivo: 'ja_estornado' });
      expect(await tx((t) => registrarEstornoSombra(t, { ...entrada(c, { valorReembolsado: 9.9 }), status: 'refunded' }))).toEqual({ resultado: 'estornado', valorCentavos: 124 });
      expect(Number((await q(`SELECT sum(valor_centavos) s FROM colaborador_lancamentos WHERE pagamento_ref = $1`, [c.pay]))[0].s)).toBe(0);
      expect(await tx((t) => registrarEstornoSombra(t, { ...entrada(c), status: 'charged_back' }))).toEqual({ resultado: 'nada_a_fazer', motivo: 'ja_estornado' });
    });
    it('estorno de pagamento sem comissão (sem colaborador, interno etc.): nada a fazer', async () => {
      const c = await cenario({ semColab: true }); await tx((t) => registrarComissaoSombra(t, entrada(c)));
      expect(await tx((t) => registrarEstornoSombra(t, { ...entrada(c), status: 'refunded' }))).toEqual({ resultado: 'nada_a_fazer', motivo: 'sem_comissao_do_pagamento' });
    });
    it('saldo é SOMA do livro: pendente até o prazo e a verificação; estorno desconta na hora', async () => {
      const c = await cenario(); const agora = new Date('2026-12-01T12:00:00Z');
      await tx((t) => registrarComissaoSombra(t, entrada(c), agora));
      expect(await saldoDoColaborador(consulta, c.colabId, agora)).toEqual({ pendenteCentavos: 247, disponivelCentavos: 0, totalCentavos: 247 });
      expect(await saldoDoColaborador(consulta, c.colabId, new Date('2026-12-16T00:00:00Z'))).toEqual({ pendenteCentavos: 0, disponivelCentavos: 247, totalCentavos: 247 });
      await pool.query('UPDATE colaboradores SET verificado_em = NULL WHERE id = $1', [c.colabId]);
      expect(await saldoDoColaborador(consulta, c.colabId, new Date('2026-12-16T00:00:00Z'))).toEqual({ pendenteCentavos: 247, disponivelCentavos: 0, totalCentavos: 247 }); // canal não verificado: nada liberado
      await pool.query('UPDATE colaboradores SET verificado_em = now() WHERE id = $1', [c.colabId]);
      await tx((t) => registrarEstornoSombra(t, { ...entrada(c), status: 'charged_back' }));
      expect(await saldoDoColaborador(consulta, c.colabId, new Date('2026-12-16T00:00:00Z'))).toEqual({ pendenteCentavos: 0, disponivelCentavos: 0, totalCentavos: 0 });
    });
  });

  describe('E. no webhook: camada isolada e rota de conferência', () => {
    let POST: (r: NextRequest) => Promise<Response>; let LIVRO: (r: NextRequest) => Promise<Response>;
    const aviso = (id: string) => new NextRequest('http://localhost/api/v1/webhooks/mercadopago', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'payment', data: { id } }) });
    const paga = (id: string, meta: Record<string, string>, extra: Record<string, unknown> = {}, status = 'approved') => { mp.resposta = { status, transaction_amount: 9.9, metadata: meta, ...extra }; return POST(aviso(id)); };
    beforeAll(async () => {
      process.env.MP_ACCESS_TOKEN = 'TEST-x';
      POST = (await import('@/app/api/v1/webhooks/mercadopago/route')).POST as never; LIVRO = (await import('@/app/api/v1/admin/colaboradores/lancamentos/route')).GET as never;
    });
    beforeEach(() => { delete process.env.COMISSAO_SOMBRA; process.env.COLABORADORES_ATIVO = '1'; adm.papel = 'admin'; });
    afterAll(() => { delete process.env.COMISSAO_SOMBRA; delete process.env.COLABORADORES_ATIVO; });
    // O webhook cria o boost: parte do cenário sem o boost já gravado.
    async function pedido(o: Parameters<typeof cenario>[0] = {}) { const c = await cenario(o); await pool.query('DELETE FROM boosts WHERE id = $1', [c.boostId]); return { ...c, meta: { type: 'boost', boost_type: 'boost_7', object_id: c.objId, user_id: c.comprador, days: '7' } }; }
    const lancs = async (pay: string) => q('SELECT tipo, valor_centavos FROM colaborador_lancamentos WHERE pagamento_ref = $1 ORDER BY criado_em', [pay]);

    it('DESLIGADO (sem COMISSAO_SOMBRA): o boost ativa como antes e NADA é lido ou gravado no livro', async () => {
      const p = await pedido(); const r = await paga(p.pay, p.meta); expect(r.status).toBe(200);
      expect((await q('SELECT count(*)::int n FROM boosts WHERE provider_ref = $1', [p.pay]))[0].n).toBe(1); expect((await lancs(p.pay)).length).toBe(0);
      expect((await q('SELECT count(*)::int n FROM pagamento_eventos WHERE pagamento_id = $1', [p.pay]))[0].n).toBe(0);
    });
    it('LIGADO: boost ativa E a comissão é lançada; o aviso repetido não duplica nada', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      const p = await pedido(); expect((await paga(p.pay, p.meta)).status).toBe(200); expect((await paga(p.pay, p.meta)).status).toBe(200);
      expect(await lancs(p.pay)).toEqual([{ tipo: 'comissao', valor_centavos: 247 }]); expect((await q('SELECT count(*)::int n FROM boosts WHERE provider_ref = $1', [p.pay]))[0].n).toBe(1);
    });
    it('LIGADO, ocorrência SEM colaborador: nada no livro; boost normal', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      const p = await pedido({ semColab: true }); await paga(p.pay, p.meta); expect((await lancs(p.pay)).length).toBe(0);
    });
    it('FALHA na camada de comissão NUNCA derruba o boost nem muda a resposta (200, boost gravado)', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      await pool.query('ALTER TABLE colaborador_lancamentos RENAME TO lanc_x');
      try {
        const p = await pedido(); const r = await paga(p.pay, p.meta);
        expect(r.status).toBe(200); expect((await r.json()).status).toBe('processed');
        expect((await q('SELECT count(*)::int n FROM boosts WHERE provider_ref = $1', [p.pay]))[0].n).toBe(1); expect((await q('SELECT is_boosted FROM objects WHERE id = $1', [p.objId]))[0].is_boosted).toBe(true);
      } finally { await pool.query('ALTER TABLE lanc_x RENAME TO colaborador_lancamentos'); }
    });
    it('reprocessar um aviso depois de a camada ter falhado concilia o lançamento (aviso repetido = already_processed + comissão)', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      const p = await pedido();
      await pool.query('ALTER TABLE colaborador_lancamentos RENAME TO lanc_x'); await paga(p.pay, p.meta); await pool.query('ALTER TABLE lanc_x RENAME TO colaborador_lancamentos');
      expect((await lancs(p.pay)).length).toBe(0);
      const r = await paga(p.pay, p.meta); expect((await r.json()).status).toBe('already_processed');
      expect(await lancs(p.pay)).toEqual([{ tipo: 'comissao', valor_centavos: 247 }]);
    });
    it('estorno pelo webhook: lançamento negativo, o boost continua ativo e a resposta é a de antes (refund_noted)', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      const p = await pedido(); await paga(p.pay, p.meta);
      const r = await paga(p.pay, p.meta, {}, 'charged_back'); expect((await r.json()).status).toBe('refund_noted');
      expect(await lancs(p.pay)).toEqual([{ tipo: 'comissao', valor_centavos: 247 }, { tipo: 'estorno', valor_centavos: -247 }]);
      expect((await q('SELECT status FROM boosts WHERE provider_ref = $1', [p.pay]))[0].status).toBe('active');
      await paga(p.pay, p.meta, {}, 'charged_back'); expect((await lancs(p.pay)).length).toBe(2);
    });
    it('reembolso parcial chega como «approved» com valor devolvido: estorno proporcional', async () => {
      process.env.COMISSAO_SOMBRA = '1';
      const p = await pedido(); await paga(p.pay, p.meta); await paga(p.pay, p.meta, { transaction_amount_refunded: 4.95 });
      expect(await lancs(p.pay)).toEqual([{ tipo: 'comissao', valor_centavos: 247 }, { tipo: 'estorno', valor_centavos: -123 }]);
    });
    it('rota de conferência do admin: 404 desligada, 403 sem admin, resumo e livro por @nome (sem expor dado pessoal)', async () => {
      const req = (qs = '') => new NextRequest(`http://localhost/api/v1/admin/colaboradores/lancamentos${qs}`);
      expect((await LIVRO(req())).status).toBe(404);
      process.env.COMISSAO_SOMBRA = '1'; adm.papel = 'nao'; expect((await LIVRO(req())).status).toBe(403); adm.papel = 'admin';
      const p = await pedido(); await paga(p.pay, p.meta);
      const slug = String((await q('SELECT slug FROM colaboradores WHERE id = $1', [p.colabId]))[0].slug);
      const resumo = await (await LIVRO(req())).json(); expect(resumo.resumo.some((x: { slug: string; total_centavos: number }) => x.slug === slug && x.total_centavos === 247)).toBe(true);
      const j = await (await LIVRO(req(`?slug=@${slug.toUpperCase()}`))).json();
      expect(j.ok).toBe(true); expect(j.saldo).toEqual({ pendenteCentavos: 247, disponivelCentavos: 0, totalCentavos: 247 }); expect(j.lancamentos[0]).toMatchObject({ tipo: 'comissao', valor_centavos: 247, pagamento_ref: p.pay });
      expect(JSON.stringify(j)).not.toMatch(/email|user_id|nome/i); expect((await LIVRO(req('?slug=nao-existe-xyz'))).status).toBe(404); expect((await LIVRO(req('?slug=a'))).status).toBe(400);
    });
  });
});

describe('D. isolamento (sem banco)', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('nenhuma tela lê o livro: a inscrição e a página pública seguem sem valores; o painel só mostra o que o SERVIDOR devolve (E6: saldo atrás de COLABORADORES_SALDO)', () => {
    for (const f of ['src/components/colaboradores/FormularioInscricao.tsx', 'src/app/colaborador/[slug]/page.tsx']) expect(r(f), f).not.toMatch(/saldoDoColaborador|colaborador_lancamentos|comissao_sombra|centavos/i);
    expect(r('src/app/dashboard/colaborador/page.tsx')).not.toMatch(/saldoDoColaborador|colaborador_lancamentos|comissao_sombra/i); // a tela nunca importa o livro: só mostra `painel.saldo` vindo da API
    expect(r('src/app/dashboard/colaborador/page.tsx')).toContain('{dados.comissao}'); expect(r('src/lib/colaboradores/inscricao.ts')).toContain("TEXTO_COMISSAO_EM_APURACAO = 'Comissão em apuração'"); // o painel só mostra o texto «em apuração» vindo do servidor
  });
  it('o webhook chama a camada de comissão só por `sombraSegura` (erro nunca muda a resposta) e só com o interruptor', () => {
    const s = r('src/app/api/v1/webhooks/mercadopago/route.ts');
    expect(s).toContain('comissaoSombraAtiva()'); expect(s.match(/sombraSegura\(/g)!.length).toBeGreaterThanOrEqual(3);
    expect(s).not.toMatch(/await registrar(Comissao|Estorno)Sombra\(/); // nunca direto: sempre por sombraSegura
  });
  it('nenhum código do programa lê ou grava o livro fora de src/lib/colaboradores/comissao.ts e da rota de conferência do admin', () => {
    const arqs = ['src/app/api/v1/webhooks/mercadopago/route.ts', 'src/app/api/v1/boost/route.ts', 'src/app/api/v1/checkout/mercadopago/route.ts', 'src/lib/colaboradores/inscricao.ts', 'src/lib/colaboradores/feed.ts'];
    for (const f of arqs) expect(r(f), f).not.toMatch(/colaborador_lancamentos|programa_config/);
  });
});
