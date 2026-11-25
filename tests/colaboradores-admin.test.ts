// Programa de Colaboradores, E7 (admin): estados, ajuste, fila de saques, regras versionadas, métricas, CSV seguro, auditoria imutável e rotas.
// A e E: sem banco. B e D: Postgres REAL (puladas sem TEST_DATABASE_URL); aplicam as migrations 026, 028, 029 e 030 sobre tabelas mínimas.
// ATENÇÃO: recria users, objects, boosts, colaboradores e as tabelas novas no banco de teste.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const adm = vi.hoisted(() => ({ papel: 'admin' as 'admin' | 'nao', id: '' }));
vi.mock('@/lib/adminGuard', async () => {
  const { NextResponse } = await import('next/server');
  return { requireAdmin: async () => (adm.papel === 'admin' ? { user: { id: adm.id, role: 'admin' } } : NextResponse.json({ error: 'Forbidden' }, { status: 403 })) };
});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { adminAtivo, celulaCsv, csvDaLista, mesAtual, mesValido, validarRegra, mudarEstado, ajusteDoAdmin, pagarSaque, recusarSaque, definirRegra, regrasVigentes, listaDeColaboradores, listarSaquesAdmin, CHAVES_DE_REGRA } from '@/lib/colaboradores/admin';
import { saldoDoColaborador } from '@/lib/colaboradores/comissao';
import { salvarDadosPagamento, solicitarSaque } from '@/lib/colaboradores/saque';
import { validarDadosPagamento } from '@/lib/colaboradores/pagamento';
import { randomBytes } from 'node:crypto';

const ENV = { PIX_CHAVE_CIFRAGEM: randomBytes(32).toString('base64') };

describe('A. regras, CSV e interruptor (sem banco)', () => {
  it('interruptor do admin: só com COLABORADORES_ATIVO=1', () => { expect(adminAtivo({})).toBe(false); expect(adminAtivo({ COLABORADORES_ATIVO: '1' })).toBe(true); expect(adminAtivo({ COLABORADORES_ATIVO: 'true' })).toBe(false); });
  it('validação de cada regra (as 6 chaves das decisões do fundador)', () => {
    expect([...CHAVES_DE_REGRA].sort()).toEqual(['comissao_arredondamento', 'comissao_percentual', 'exclusao_cancela_saldo', 'prazo_liberacao_dias', 'prazo_saque_dias_uteis', 'saque_minimo_centavos']);
    expect(validarRegra('comissao_percentual', '25')).toEqual({ ok: true, valor: '25' }); expect(validarRegra('comissao_percentual', '12,5')).toEqual({ ok: true, valor: '12.5' });
    for (const v of ['0', '101', '-1', 'abc', '', '1.234', null]) expect(validarRegra('comissao_percentual', v).ok, String(v)).toBe(false);
    expect(validarRegra('comissao_arredondamento', 'cima').ok).toBe(true); expect(validarRegra('comissao_arredondamento', 'x').ok).toBe(false);
    expect(validarRegra('prazo_liberacao_dias', '14').ok).toBe(true); for (const v of ['-1', '366', '1.5', 'x']) expect(validarRegra('prazo_liberacao_dias', v).ok).toBe(false);
    expect(validarRegra('saque_minimo_centavos', '5000').ok).toBe(true); for (const v of ['99', '1000001', 'x']) expect(validarRegra('saque_minimo_centavos', v).ok).toBe(false);
    expect(validarRegra('prazo_saque_dias_uteis', '10').ok).toBe(true); for (const v of ['0', '31']) expect(validarRegra('prazo_saque_dias_uteis', v).ok).toBe(false);
    expect(validarRegra('exclusao_cancela_saldo', 'sim').ok).toBe(true); expect(validarRegra('exclusao_cancela_saldo', 'talvez').ok).toBe(false); expect(validarRegra('outra', '1').ok).toBe(false);
  });
  it('mês no formato AAAA-MM', () => { expect(mesValido('2026-11')).toBe(true); for (const m of ['2026-13', '2026-00', '26-11', '2026-1', '', null, 'xyz']) expect(mesValido(m)).toBe(false); expect(mesAtual(new Date('2026-11-24T12:00:00Z'))).toBe('2026-11'); });
  it('CSV seguro: texto de terceiros nunca vira fórmula de planilha; aspas escapadas', () => {
    for (const t of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1']) expect(celulaCsv(t).startsWith('"\'')).toBe(true);
    expect(celulaCsv('Grupo "Zona Leste"')).toBe('"Grupo ""Zona Leste"""'); expect(celulaCsv(null)).toBe('""'); expect(celulaCsv(247)).toBe('"247"');
    const csv = csvDaLista('2026-11', [{ slug: 'a-b', nome: '=cmd|calc', estado: 'ativo', verificado: true, ocorrencias_no_mes: 2, compras_no_mes: 1, comissao_no_mes_centavos: 247, saldo_total_centavos: 247 }]);
    expect(csv.split('\r\n')[0]).toBe('mes,slug,nome,estado,verificado,visitas_no_mes,ocorrencias_no_mes,compras_no_mes,comissao_no_mes_centavos,saldo_total_centavos'); expect(csv).toContain(`"'=cmd|calc"`); expect(csv).not.toMatch(/chave|pix|documento|cpf/i);
  });
});

describe.skipIf(!TEST_DB)('B/D. com Postgres real', () => {
  let pool: Pool;
  const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p);
  const tx = async <T>(f: (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const MIG = (n: string) => readFileSync(path.join(__dirname, `../src/db/migrations/${n}`), 'utf8');
  const novoUsuario = async () => { const id = randomUUID(); await pool.query('INSERT INTO users (id) VALUES ($1)', [id]); return id; };
  const novoColab = async (o: { estado?: string; interno?: boolean; verificado?: boolean } = {}) => {
    const user = await novoUsuario(); const id = randomUUID();
    await pool.query(`INSERT INTO colaboradores (id, user_id, slug, codigo_curto, nome, estado, interno, verificado_em) VALUES ($1,$2,$3,$4,'Colab',$5,$6,$7)`,
      [id, user, `c-${randomUUID().slice(0, 8)}`, randomUUID().replace(/[^2-9A-HJ-NP-Z]/gi, 'C').slice(0, 4).toUpperCase(), o.estado ?? 'ativo', o.interno ?? false, o.verificado === false ? null : new Date().toISOString()]);
    return { user, id };
  };
  const credito = (colabId: string, centavos: number, pendente = false) => pool.query(
    `INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, pagamento_ref, base_centavos, percentual_aplicado, disponivel_em, chave_idempotencia) VALUES ($1,'comissao',$2,$3,$4,25,$5,$6)`,
    [colabId, centavos, `p${randomUUID().slice(0, 8)}`, centavos * 4, pendente ? new Date(Date.now() + 10 * 86_400_000).toISOString() : new Date(Date.now() - 86_400_000).toISOString(), `c:${randomUUID()}`]);
  const comSaque = async (centavos: number) => {
    const c = await novoColab(); await credito(c.id, centavos); const v = validarDadosPagamento({ tipo_chave: 'cpf', chave: '529.982.247-25', titular_nome: 'Maria da Silva', documento: '529.982.247-25' }); if (!v.ok) throw new Error('x');
    await salvarDadosPagamento(consulta, c.id, v.dados, ENV); const r = await tx((t) => solicitarSaque(t, c.user)); if (!r.ok) throw new Error(JSON.stringify(r)); return { ...c, saqueId: r.saque.id };
  };
  const auditorias = (alvo: string) => q('SELECT acao, antes, depois, motivo, ator_id FROM auditoria WHERE alvo_id = $1 ORDER BY criado_em', [alvo]);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS colaborador_sinais, colaborador_visitas_dia, auditoria, colaborador_saques, colaborador_dados_pagamento, colaborador_lancamentos, pagamento_eventos, programa_config, colaborador_verificacoes, politica_aceites, boosts, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT 'lost', created_at timestamp DEFAULT now())");
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL, type varchar NOT NULL, status varchar NOT NULL, amount_paid numeric, provider varchar, provider_ref varchar, starts_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, active boolean NOT NULL DEFAULT true)`);
    for (const m of ['026_colaboradores.sql', '027_colaboradores_inscricao.sql', '028_colaboradores_comissao.sql', '029_colaboradores_saque.sql', '030_colaboradores_auditoria.sql']) await pool.query(MIG(m));
  });
  beforeEach(async () => { adm.papel = 'admin'; adm.id = await novoUsuario(); });
  afterAll(async () => { await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  describe('B. regras do admin', () => {
    it('a migration 030 é idempotente e a auditoria só aceita INSERT', async () => {
      await pool.query(MIG('030_colaboradores_auditoria.sql'));
      const c = await novoColab(); await tx((t) => mudarEstado(t, c.id, 'suspender', adm.id, 'teste de auditoria'));
      const id = String((await q('SELECT id FROM auditoria WHERE alvo_id = $1', [c.id]))[0].id);
      await expect(pool.query('UPDATE auditoria SET motivo = $2 WHERE id = $1', [id, 'x'])).rejects.toThrow(/só aceita INSERT/); await expect(pool.query('DELETE FROM auditoria WHERE id = $1', [id])).rejects.toThrow(/só aceita INSERT/);
      await expect(pool.query('TRUNCATE auditoria')).rejects.toThrow(/só aceita INSERT/);
    });
    it('suspender exige motivo; só de ativo; reativar volta a ativo; tudo auditado com antes/depois', async () => {
      const c = await novoColab();
      expect(await tx((t) => mudarEstado(t, c.id, 'suspender', adm.id, null))).toEqual({ ok: false, erro: 'MOTIVO_OBRIGATORIO' });
      expect(await tx((t) => mudarEstado(t, c.id, 'reativar', adm.id, null))).toEqual({ ok: false, erro: 'TRANSICAO_INVALIDA' });   // ativo não se reativa
      expect(await tx((t) => mudarEstado(t, c.id, 'suspender', adm.id, ' suspeita de golpe '))).toEqual({ ok: true, estado: 'suspenso' });
      expect((await q('SELECT estado FROM colaboradores WHERE id = $1', [c.id]))[0].estado).toBe('suspenso');
      expect(await tx((t) => mudarEstado(t, c.id, 'reativar', adm.id, null))).toEqual({ ok: true, estado: 'ativo' });
      const a = await auditorias(c.id); expect(a.map((x) => x.acao)).toEqual(['colaborador_suspender', 'colaborador_reativar']);
      expect(a[0]).toMatchObject({ motivo: 'suspeita de golpe', antes: { estado: 'ativo' }, depois: { estado: 'suspenso' }, ator_id: adm.id });
    });
    it('quem SAIU também pode ser reativado pelo admin; o interno e o inexistente não mudam; excluído não volta', async () => {
      const s = await novoColab({ estado: 'saiu' }); expect(await tx((t) => mudarEstado(t, s.id, 'reativar', adm.id, null))).toEqual({ ok: true, estado: 'ativo' });
      const i = await novoColab({ interno: true }); expect(await tx((t) => mudarEstado(t, i.id, 'suspender', adm.id, 'x'))).toEqual({ ok: false, erro: 'INTERNO' });
      expect(await tx((t) => mudarEstado(t, randomUUID(), 'suspender', adm.id, 'x'))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
      const e = await novoColab(); await tx((t) => mudarEstado(t, e.id, 'excluir', adm.id, 'golpe comprovado'));
      for (const acao of ['reativar', 'suspender', 'excluir'] as const) expect(await tx((t) => mudarEstado(t, e.id, acao, adm.id, 'x'))).toEqual({ ok: false, erro: 'TRANSICAO_INVALIDA' });
    });
    it('EXCLUIR cancela o saldo não pago (pendente e disponível) e recusa o saque aberto; a linha e as ocorrências permanecem', async () => {
      const c = await comSaque(7000); await credito(c.id, 1200, true);
      const objId = randomUUID(); await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo) VALUES ($1,$2,'x',$3,'@x')`, [objId, await novoUsuario(), c.id]);
      const r = await tx((t) => mudarEstado(t, c.id, 'excluir', adm.id, 'transgressão comprovada')); expect(r).toEqual({ ok: true, estado: 'excluido', saldoCancelado: 8200 });
      expect((await saldoDoColaborador(consulta, c.id)).totalCentavos).toBe(0);   // o total (a soma do livro) é a verdade; a divisão pendente/disponível não importa para quem foi excluído
      expect((await q('SELECT estado, motivo FROM colaborador_saques WHERE id = $1', [c.saqueId]))[0]).toMatchObject({ estado: 'recusado', motivo: 'exclusão do colaborador' });
      expect((await q('SELECT count(*)::int n FROM colaboradores WHERE id = $1', [c.id]))[0].n).toBe(1); expect((await q('SELECT colaborador_codigo FROM objects WHERE id = $1', [objId]))[0].colaborador_codigo).toBe('@x');
      expect((await auditorias(c.id)).find((x) => x.acao === 'colaborador_excluir')?.depois).toMatchObject({ estado: 'excluido', saldoCanceladoCentavos: 8200 });
    });
    it('com a regra «exclusao_cancela_saldo = nao», excluir NÃO cancela o saldo', async () => {
      await pool.query(`INSERT INTO programa_config (chave, valor, vigente_desde) VALUES ('exclusao_cancela_saldo','nao', now() - interval '1 minute')`);
      try { const c = await novoColab(); await credito(c.id, 3000); expect(await tx((t) => mudarEstado(t, c.id, 'excluir', adm.id, 'x motivo'))).toEqual({ ok: true, estado: 'excluido' }); expect((await saldoDoColaborador(consulta, c.id)).totalCentavos).toBe(3000); }
      finally { await pool.query(`DELETE FROM programa_config WHERE chave = 'exclusao_cancela_saldo' AND valor = 'nao'`); }
    });
    it('ajuste: valor inteiro com sinal e motivo obrigatório; entra no livro e na auditoria', async () => {
      const c = await novoColab();
      for (const v of [0, 1.5, NaN, '5', 10_000_001, null]) expect(await tx((t) => ajusteDoAdmin(t, c.id, v, 'motivo válido', adm.id)), String(v)).toEqual({ ok: false, erro: 'VALOR_INVALIDO' });
      expect(await tx((t) => ajusteDoAdmin(t, c.id, 500, 'oi', adm.id))).toEqual({ ok: false, erro: 'MOTIVO_OBRIGATORIO' });
      expect(await tx((t) => ajusteDoAdmin(t, randomUUID(), 500, 'motivo válido', adm.id))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
      expect(await tx((t) => ajusteDoAdmin(t, c.id, 500, 'bônus de lançamento', adm.id))).toEqual({ ok: true }); expect(await tx((t) => ajusteDoAdmin(t, c.id, -200, 'correção de erro', adm.id))).toEqual({ ok: true });
      expect((await saldoDoColaborador(consulta, c.id)).totalCentavos).toBe(300); expect((await auditorias(c.id)).filter((x) => x.acao === 'ajuste_admin').length).toBe(2);
    });
    it('saque: PAGAR só marca (o livro não muda: a reserva já foi o débito), uma vez; RECUSAR exige motivo e devolve o valor', async () => {
      const a = await comSaque(6000); const antes = (await saldoDoColaborador(consulta, a.id)).totalCentavos;
      expect(await tx((t) => pagarSaque(t, randomUUID(), adm.id, null))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
      expect(await tx((t) => pagarSaque(t, a.saqueId, adm.id, ' PIX 12345 '))).toEqual({ ok: true }); expect(await tx((t) => pagarSaque(t, a.saqueId, adm.id, null))).toEqual({ ok: false, erro: 'JA_DECIDIDO' });
      expect(await tx((t) => recusarSaque(t, a.saqueId, adm.id, 'x motivo'))).toEqual({ ok: false, erro: 'JA_DECIDIDO' });
      expect((await saldoDoColaborador(consulta, a.id)).totalCentavos).toBe(antes); expect((await q('SELECT estado, comprovante, decidido_por FROM colaborador_saques WHERE id = $1', [a.saqueId]))[0]).toMatchObject({ estado: 'pago', comprovante: 'PIX 12345', decidido_por: adm.id });
      const b = await comSaque(8000); expect(await tx((t) => recusarSaque(t, b.saqueId, adm.id, ''))).toEqual({ ok: false, erro: 'MOTIVO_OBRIGATORIO' });
      expect(await tx((t) => recusarSaque(t, b.saqueId, adm.id, 'dados de pagamento inválidos'))).toEqual({ ok: true }); expect((await saldoDoColaborador(consulta, b.id)).disponivelCentavos).toBe(8000);
      expect((await auditorias(a.saqueId)).map((x) => x.acao)).toEqual(['saque_solicitado', 'saque_pago']);   // E8: o pedido do colaborador também é auditado expect(JSON.stringify(await auditorias(b.saqueId))).not.toMatch(/52998224725|chave|documento/);
    });
    it('a fila de saques mostra só dados MASCARADOS', async () => {
      const c = await comSaque(9000); const fila = await listarSaquesAdmin(consulta, 'solicitado'); const x = fila.find((s) => s.id === c.saqueId)!;
      expect(x).toMatchObject({ valor_centavos: 9000, verificado: true, chave_final: '4725', documento_final: '4725', titular_nome: 'Maria da Silva' }); expect(JSON.stringify(fila)).not.toMatch(/52998224725|chave_cifrada|v1:/);
    });
    it('regras: nova versão só daqui para frente (nunca no passado), histórico preservado, auditada; vale na hora da compra', async () => {
      const agora = new Date('2026-12-01T12:00:00Z');
      expect(await tx((t) => definirRegra(t, 'xyz', '1', undefined, 'motivo válido', adm.id, agora))).toEqual({ ok: false, erro: 'Regra desconhecida.' });
      expect((await tx((t) => definirRegra(t, 'comissao_percentual', '999', undefined, 'motivo válido', adm.id, agora))).ok).toBe(false);
      expect((await tx((t) => definirRegra(t, 'comissao_percentual', '30', undefined, 'sem', adm.id, agora))).ok).toBe(false);
      expect(await tx((t) => definirRegra(t, 'comissao_percentual', '30', '2026-11-01T00:00:00Z', 'motivo válido', adm.id, agora))).toMatchObject({ ok: false });   // passado: recusado
      const ok = await tx((t) => definirRegra(t, 'comissao_percentual', '30', '2030-01-01T00:00:00Z', 'campanha de 2030', adm.id, agora)); expect(ok).toEqual({ ok: true, vigenteDesde: '2030-01-01T00:00:00.000Z' });
      expect((await tx((t) => definirRegra(t, 'comissao_percentual', '31', '2030-01-01T00:00:00Z', 'mesma vigência', adm.id, agora))).ok).toBe(false);   // mesma chave e vigência
      const r = await regrasVigentes(consulta); expect(r.vigentes.find((x) => x.chave === 'comissao_percentual')?.valor).toBe('25'); expect(r.agendadas.find((x) => x.chave === 'comissao_percentual')?.valor).toBe('30');
      expect((await q(`SELECT count(*)::int n FROM programa_config WHERE chave = 'comissao_percentual'`))[0].n).toBeGreaterThanOrEqual(2);   // histórico: a linha antiga continua
      expect((await auditorias('comissao_percentual')).find((x) => x.motivo === 'campanha de 2030')).toMatchObject({ acao: 'regra_alterada', antes: { valor: '25' }, depois: { valor: '30' } });
      await pool.query(`DELETE FROM programa_config WHERE vigente_desde = '2030-01-01'`);
    });
    it('métricas por mês: ocorrências com o código, compras de Boost (só Mercado Pago) e comissão; saldo total do livro; sem dado pessoal', async () => {
      const c = await novoColab(); const dono = await novoUsuario(); const obj = randomUUID();
      await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo, created_at) VALUES ($1,$2,'a',$3,'@x','2026-11-10 12:00'), ($4,$2,'b',$3,'@x','2026-11-30 23:59:59'), ($5,$2,'c',$3,'@x','2026-12-01 00:00:00')`, [obj, dono, c.id, randomUUID(), randomUUID()]);
      await pool.query(`INSERT INTO boosts (object_id, user_id, type, status, provider, provider_ref, created_at) VALUES ($1,$2,'boost_7','active','mercadopago','a1','2026-11-12'), ($1,$2,'boost_7','active','test',NULL,'2026-11-12'), ($1,$2,'boost_7','active','mercadopago','a2','2026-12-02')`, [obj, dono]);
      await pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, criado_em) VALUES ($1,'comissao',247,$2,'2026-11-12'), ($1,'comissao',622,$3,'2026-12-02')`, [c.id, `k:${randomUUID()}`, `k:${randomUUID()}`]);
      const nov = (await listaDeColaboradores(consulta, '2026-11')).find((x) => x.id === c.id)!; expect(nov).toMatchObject({ ocorrencias_no_mes: 2, compras_no_mes: 1, comissao_no_mes_centavos: 247, saldo_total_centavos: 869 });
      const dez = (await listaDeColaboradores(consulta, '2026-12')).find((x) => x.id === c.id)!; expect(dez).toMatchObject({ ocorrencias_no_mes: 1, compras_no_mes: 1, comissao_no_mes_centavos: 622 });
      expect(JSON.stringify(nov)).not.toMatch(/user_id|email|chave/);
    });
  });

  describe('D. rotas', () => {
    const R: Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>> = {};
    const req = (url: string, init: { method?: string; corpo?: unknown } = {}) => new NextRequest(`http://localhost${url}`, { method: init.method ?? 'GET', headers: { 'content-type': 'application/json' }, body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo) });
    beforeAll(async () => {
      R.lista = (await import('@/app/api/v1/admin/colaboradores/lista/route')).GET as never; R.export = (await import('@/app/api/v1/admin/colaboradores/export/route')).GET as never;
      R.estado = (await import('@/app/api/v1/admin/colaboradores/[id]/estado/route')).POST as never; R.ajuste = (await import('@/app/api/v1/admin/colaboradores/[id]/ajuste/route')).POST as never;
      R.saques = (await import('@/app/api/v1/admin/colaboradores/saques/route')).GET as never; R.saque = (await import('@/app/api/v1/admin/colaboradores/saques/[id]/route')).POST as never;
      R.regrasGet = (await import('@/app/api/v1/admin/colaboradores/regras/route')).GET as never; R.regrasPost = (await import('@/app/api/v1/admin/colaboradores/regras/route')).POST as never;
    });
    const on = () => { process.env.COLABORADORES_ATIVO = '1'; }; const off = () => { delete process.env.COLABORADORES_ATIVO; };
    afterAll(() => off());
    const todas = (id = randomUUID()) => [() => R.lista(req('/x')), () => R.export(req('/x')), () => R.estado(req('/x', { method: 'POST', corpo: { acao: 'suspender', motivo: 'x' } }), { params: { id } }), () => R.ajuste(req('/x', { method: 'POST', corpo: {} }), { params: { id } }),
      () => R.saques(req('/x')), () => R.saque(req('/x', { method: 'POST', corpo: { decisao: 'pagar' } }), { params: { id } }), () => R.regrasGet(req('/x')), () => R.regrasPost(req('/x', { method: 'POST', corpo: {} }))];

    it('desligado (sem COLABORADORES_ATIVO): tudo 404; ligado e sem admin: 403', async () => {
      off(); for (const f of todas()) expect((await f()).status).toBe(404);
      on(); adm.papel = 'nao'; for (const f of todas()) expect((await f()).status).toBe(403);
    });
    it('lista, exportação CSV, estado, ajuste, saque e regras pelas rotas', async () => {
      on(); const c = await novoColab(); await credito(c.id, 5000);
      const l = await (await R.lista(req('/x?mes=2026-11'))).json(); expect(l.colaboradores.some((x: { id: string }) => x.id === c.id)).toBe(true); expect((await R.lista(req('/x?mes=xx'))).status).toBe(400);
      const csv = await R.export(req('/x?mes=2026-11')); expect(csv.headers.get('content-type')).toContain('text/csv'); expect(csv.headers.get('content-disposition')).toContain('colaboradores-2026-11.csv'); expect(await csv.text()).toContain('mes,slug,nome');
      expect((await R.estado(req('/x', { method: 'POST', corpo: { acao: 'voar' } }), { params: { id: c.id } })).status).toBe(400); expect((await R.estado(req('/x', { method: 'POST', corpo: { acao: 'suspender' } }), { params: { id: c.id } })).status).toBe(400);
      expect((await R.estado(req('/x', { method: 'POST', corpo: { acao: 'suspender', motivo: 'análise de suspeita' } }), { params: { id: c.id } })).status).toBe(200); expect((await R.estado(req('/x', { method: 'POST', corpo: { acao: 'suspender', motivo: 'de novo' } }), { params: { id: c.id } })).status).toBe(409);
      expect((await R.estado(req('/x', { method: 'POST', corpo: { acao: 'reativar' } }), { params: { id: 'nao-uuid' } })).status).toBe(400);
      expect((await R.ajuste(req('/x', { method: 'POST', corpo: { valor_centavos: 1000, motivo: 'bônus de teste' } }), { params: { id: c.id } })).status).toBe(200); expect((await R.ajuste(req('/x', { method: 'POST', corpo: { valor_centavos: 0, motivo: 'bônus de teste' } }), { params: { id: c.id } })).status).toBe(400);
      const s = await comSaque(6000); const fila = await (await R.saques(req('/x'))).json(); expect(fila.saques.some((x: { id: string }) => x.id === s.saqueId)).toBe(true); expect((await R.saques(req('/x?estado=xyz'))).status).toBe(400);
      expect((await R.saque(req('/x', { method: 'POST', corpo: { decisao: 'talvez' } }), { params: { id: s.saqueId } })).status).toBe(400); expect((await R.saque(req('/x', { method: 'POST', corpo: { decisao: 'recusar' } }), { params: { id: s.saqueId } })).status).toBe(400);
      expect((await R.saque(req('/x', { method: 'POST', corpo: { decisao: 'pagar', comprovante: 'PIX 1' } }), { params: { id: s.saqueId } })).status).toBe(200); expect((await R.saque(req('/x', { method: 'POST', corpo: { decisao: 'pagar' } }), { params: { id: s.saqueId } })).status).toBe(409);
      const rg = await (await R.regrasGet(req('/x'))).json(); expect(rg.vigentes.length).toBe(6);
      expect((await R.regrasPost(req('/x', { method: 'POST', corpo: { chave: 'prazo_liberacao_dias', valor: '21', vigente_desde: '2031-01-01T00:00:00Z', motivo: 'ajuste de prazo' } }))).status).toBe(201); expect((await R.regrasPost(req('/x', { method: 'POST', corpo: { chave: 'prazo_liberacao_dias', valor: 'x', motivo: 'ajuste de prazo' } }))).status).toBe(400);
      await pool.query(`DELETE FROM programa_config WHERE vigente_desde = '2031-01-01'`);
    });
  });
});

describe('E. tela e navegação (sem banco)', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('o admin ganha o item «Colaboradores»; a tela nunca recebe chave PIX nem documento inteiros; texto de terceiros é escapado pelo React', () => {
    expect(r('src/app/admin/layout.tsx')).toContain("/admin/colaboradores'"); const tela = r('src/app/admin/colaboradores/page.tsx');
    expect(tela).not.toMatch(/dangerouslySetInnerHTML|chave_cifrada|documento_cifrado|decifrar/); expect(tela).toContain('chave_final'); expect(tela).toContain('rel="nofollow noopener noreferrer"');
  });
  it('as rotas do admin passam todas pelo guarda único (interruptor + papel de admin)', () => {
    for (const f of ['lista', 'export', '[id]/estado', '[id]/ajuste', 'saques', 'saques/[id]', 'regras']) expect(r(`src/app/api/v1/admin/colaboradores/${f}/route.ts`), f).toContain('guardaAdmin(req)');
  });
});
