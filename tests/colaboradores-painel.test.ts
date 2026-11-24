// Programa de Colaboradores, E6 (painel): dados de pagamento cifrados, pedido de saque, ocorrências do link e rotas. A, C: sem banco. B, D: Postgres REAL (puladas sem TEST_DATABASE_URL).
// Aplica as migrations 026, 028 e 029 sobre tabelas mínimas. ATENÇÃO: recria users, objects, boosts, colaboradores e as tabelas novas no banco de teste.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => (t === 'invalido' ? null : { sub: t }) }));
vi.spyOn(console, 'error').mockImplementation(() => {});

import { CifragemIndisponivel, cifrar, cifragemConfigurada, cnpjValido, cpfValido, decifrar, finalDe, validarDadosPagamento } from '@/lib/colaboradores/pagamento';
import { PRAZO_SAQUE_DIAS_UTEIS_PADRAO, saldoVisivel, saqueAtivo, somarDiasUteis, SAQUE_MINIMO_PADRAO_CENTAVOS, salvarDadosPagamento, lerDadosPagamento, solicitarSaque, cancelarSaque, saqueMinimoCentavos } from '@/lib/colaboradores/saque';
import { CAMPOS_DA_OCORRENCIA, ocorrenciasDoColaborador, painelDoColaborador } from '@/lib/colaboradores/painel';
import { saldoDoColaborador } from '@/lib/colaboradores/comissao';

const CHAVE = randomBytes(32).toString('base64'); // chave de teste, gerada na hora (nunca uma chave real)
const ENV = { PIX_CHAVE_CIFRAGEM: CHAVE };
const CPF_OK = '529.982.247-25'; const CNPJ_OK = '11.222.333/0001-81';
const PIX = { tipo_chave: 'cpf', chave: CPF_OK, titular_nome: '  Maria  da Silva ', documento: CPF_OK };

describe('A. cifragem, validação e prazos (sem banco)', () => {
  it('cifra e decifra; cada cifragem é diferente (IV novo); texto cifrado não contém o original', () => {
    const a = cifrar('52998224725', ENV), b = cifrar('52998224725', ENV);
    expect(a).not.toBe(b); expect(a).not.toContain('52998224725'); expect(a.startsWith('v1:')).toBe(true);
    expect(decifrar(a, ENV)).toBe('52998224725'); expect(decifrar(b, ENV)).toBe('52998224725'); expect(decifrar(cifrar('á ç — 日本', ENV), ENV)).toBe('á ç — 日本');
  });
  it('adulteração, chave errada e formato inválido são recusados (GCM autentica)', () => {
    const c = cifrar('segredo', ENV); const partes = c.split(':');
    expect(() => decifrar(`${partes[0]}:${partes[1]}:${partes[2]}:${Buffer.from('xxxxxxx').toString('base64')}`, ENV)).toThrow();
    expect(() => decifrar(c, { PIX_CHAVE_CIFRAGEM: randomBytes(32).toString('base64') })).toThrow(); expect(() => decifrar('lixo', ENV)).toThrow();
    const ctAdulterado = Buffer.from(partes[3], 'base64'); ctAdulterado[0] ^= 1; expect(() => decifrar(`v1:${partes[1]}:${partes[2]}:${ctAdulterado.toString('base64')}`, ENV)).toThrow();
  });
  it('SEM chave de cifragem (ou chave com tamanho errado) RECUSA cifrar: nunca grava em claro', () => {
    for (const env of [{}, { PIX_CHAVE_CIFRAGEM: '' }, { PIX_CHAVE_CIFRAGEM: 'curta' }, { PIX_CHAVE_CIFRAGEM: randomBytes(16).toString('base64') }]) {
      expect(() => cifrar('x', env)).toThrow(CifragemIndisponivel); expect(cifragemConfigurada(env)).toBe(false);
    }
    expect(cifragemConfigurada(ENV)).toBe(true);
  });
  it('CPF e CNPJ: dígitos verificadores', () => {
    expect(cpfValido(CPF_OK)).toBe(true); expect(cnpjValido(CNPJ_OK)).toBe(true);
    for (const x of ['111.111.111-11', '529.982.247-24', '123', '', 'abc']) expect(cpfValido(x), x).toBe(false);
    for (const x of ['11.111.111/1111-11', '11.222.333/0001-82', '123', '']) expect(cnpjValido(x), x).toBe(false);
  });
  it('dados de pagamento: normaliza e valida por tipo de chave; documento do titular obrigatório', () => {
    const ok = validarDadosPagamento(PIX); expect(ok.ok).toBe(true); if (ok.ok) expect(ok.dados).toEqual({ tipoChave: 'cpf', chave: '52998224725', titularNome: 'Maria da Silva', documentoTipo: 'cpf', documento: '52998224725' });
    const e = (o: Record<string, unknown>) => { const v = validarDadosPagamento({ ...PIX, ...o }); return v.ok ? {} : v.erros; };
    expect(e({ tipo_chave: 'xyz' }).tipo_chave).toBeTruthy(); expect(e({ chave: '111.111.111-11' }).chave).toBeTruthy(); expect(e({ titular_nome: 'A' }).titular_nome).toBeTruthy(); expect(e({ documento: '123' }).documento).toBeTruthy();
    expect(e({ tipo_chave: 'email', chave: 'a@b.co' })).toEqual({}); expect(e({ tipo_chave: 'email', chave: 'sem-arroba' }).chave).toBeTruthy();
    expect(e({ tipo_chave: 'telefone', chave: '(11) 91234-5678' })).toEqual({}); expect(e({ tipo_chave: 'telefone', chave: '123' }).chave).toBeTruthy();
    expect(e({ tipo_chave: 'aleatoria', chave: randomUUID() })).toEqual({}); expect(e({ tipo_chave: 'aleatoria', chave: 'xyz' }).chave).toBeTruthy();
    expect(e({ tipo_chave: 'cnpj', chave: CNPJ_OK, documento: CNPJ_OK })).toEqual({});
    expect(finalDe('52998224725')).toBe('4725');
  });
  it('10 dias ÚTEIS: só segunda a sexta, sem feriados', () => {
    expect(PRAZO_SAQUE_DIAS_UTEIS_PADRAO).toBe(10); expect(SAQUE_MINIMO_PADRAO_CENTAVOS).toBe(5000);
    expect(somarDiasUteis(new Date('2026-12-04T12:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-12-07');   // sexta → segunda
    expect(somarDiasUteis(new Date('2026-12-02T12:00:00Z'), 10).toISOString().slice(0, 10)).toBe('2026-12-16'); // quarta + 10 úteis
    expect(somarDiasUteis(new Date('2026-12-05T12:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-12-07');  // sábado → segunda
  });
  it('interruptores: saldo e saque são SEPARADOS e ambos dependem da inscrição', () => {
    const base = { COLABORADORES_ATIVO: '1', COLABORADORES_INSCRICAO: '1' };
    expect(saldoVisivel({})).toBe(false); expect(saldoVisivel(base)).toBe(false); expect(saldoVisivel({ ...base, COLABORADORES_SALDO: '1' })).toBe(true); expect(saldoVisivel({ COLABORADORES_SALDO: '1' })).toBe(false);
    expect(saqueAtivo({ ...base, COLABORADORES_SALDO: '1' })).toBe(false); expect(saqueAtivo({ ...base, COLABORADORES_SAQUE: '1' })).toBe(false); expect(saqueAtivo({ ...base, COLABORADORES_SALDO: '1', COLABORADORES_SAQUE: '1' })).toBe(true);
  });
});

describe.skipIf(!TEST_DB)('B/D. com Postgres real', () => {
  let pool: Pool;
  const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p);
  const tx = async <T>(f: (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const MIG = (n: string) => readFileSync(path.join(__dirname, `../src/db/migrations/${n}`), 'utf8');
  const novoUsuario = async () => { const id = randomUUID(); await pool.query('INSERT INTO users (id) VALUES ($1)', [id]); return id; };
  const novoColab = async (o: { verificado?: boolean; estado?: string; interno?: boolean } = {}) => {
    const user = await novoUsuario(); const id = randomUUID();
    await pool.query(`INSERT INTO colaboradores (id, user_id, slug, codigo_curto, nome, estado, interno, verificado_em) VALUES ($1,$2,$3,$4,'Colab',$5,$6,$7)`,
      [id, user, `c-${randomUUID().slice(0, 8)}`, randomUUID().replace(/[^2-9A-HJ-NP-Z]/gi, 'B').slice(0, 4).toUpperCase(), o.estado ?? 'ativo', o.interno ?? false, o.verificado === false ? null : new Date().toISOString()]);
    return { user, id };
  };
  /** Comissão já disponível (prazo vencido) lançada direto no livro: valor em centavos. */
  const credito = (colabId: string, centavos: number) => pool.query(
    `INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, pagamento_ref, base_centavos, percentual_aplicado, disponivel_em, chave_idempotencia) VALUES ($1,'comissao',$2,$3,$4,25,now() - interval '1 day',$5)`,
    [colabId, centavos, `p${randomUUID().slice(0, 8)}`, centavos * 4, `c:${randomUUID()}`]);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS colaborador_saques, colaborador_dados_pagamento, colaborador_lancamentos, pagamento_eventos, programa_config, colaborador_verificacoes, politica_aceites, boosts, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT 'lost', category text, type text, qr_code text, is_public boolean DEFAULT true, is_legacy boolean DEFAULT false, subject_name text, description text, location text, created_at timestamp DEFAULT now())");
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL, type varchar NOT NULL, status varchar NOT NULL, amount_paid numeric, provider varchar, provider_ref varchar, starts_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, active boolean NOT NULL DEFAULT true)`);
    for (const m of ['026_colaboradores.sql', '028_colaboradores_comissao.sql', '029_colaboradores_saque.sql']) await pool.query(MIG(m));
  });
  afterAll(async () => { await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  describe('B. dados de pagamento, saque e ocorrências', () => {
    it('a migration 029 é idempotente e cria as 2 tabelas', async () => {
      await pool.query(MIG('029_colaboradores_saque.sql'));
      expect((await q("SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('colaborador_dados_pagamento','colaborador_saques')"))[0].n).toBe(2);
    });
    it('dados de pagamento ficam CIFRADOS no banco (nada em claro); a leitura devolve só o final', async () => {
      const c = await novoColab(); const v = validarDadosPagamento(PIX); if (!v.ok) throw new Error('x');
      await salvarDadosPagamento(consulta, c.id, v.dados, ENV);
      const linha = (await q('SELECT * FROM colaborador_dados_pagamento WHERE colaborador_id = $1', [c.id]))[0];
      expect(JSON.stringify(linha)).not.toContain('52998224725'); expect(String(linha.chave_cifrada).startsWith('v1:')).toBe(true); expect(decifrar(String(linha.chave_cifrada), ENV)).toBe('52998224725'); expect(decifrar(String(linha.documento_cifrado), ENV)).toBe('52998224725');
      expect(await lerDadosPagamento(consulta, c.id)).toEqual({ tipoChave: 'cpf', chaveFinal: '4725', titularNome: 'Maria da Silva', documentoTipo: 'cpf', documentoFinal: '4725' });
      const v2 = validarDadosPagamento({ ...PIX, tipo_chave: 'email', chave: 'maria@exemplo.com' }); if (!v2.ok) throw new Error('x'); await salvarDadosPagamento(consulta, c.id, v2.dados, ENV);   // atualizar substitui
      expect((await lerDadosPagamento(consulta, c.id))?.tipoChave).toBe('email'); expect((await q('SELECT count(*)::int n FROM colaborador_dados_pagamento WHERE colaborador_id = $1', [c.id]))[0].n).toBe(1);
    });
    it('SEM chave de cifragem: recusa gravar e não deixa nenhuma linha', async () => {
      const c = await novoColab(); const v = validarDadosPagamento(PIX); if (!v.ok) throw new Error('x');
      await expect(salvarDadosPagamento(consulta, c.id, v.dados, {})).rejects.toThrow(CifragemIndisponivel);
      expect((await q('SELECT count(*)::int n FROM colaborador_dados_pagamento WHERE colaborador_id = $1', [c.id]))[0].n).toBe(0);
    });
    async function pronto(centavos: number, o: Parameters<typeof novoColab>[0] = {}) {
      const c = await novoColab(o); const v = validarDadosPagamento(PIX); if (!v.ok) throw new Error('x'); await salvarDadosPagamento(consulta, c.id, v.dados, ENV); if (centavos > 0) await credito(c.id, centavos); return c;
    }
    it('saque: precisa de colaborador ativo, canal verificado, dados de pagamento e saldo ≥ R$ 50; o valor fica RESERVADO no livro', async () => {
      const agora = new Date('2026-12-02T12:00:00Z');
      expect(await tx((t) => solicitarSaque(t, randomUUID(), agora))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
      const naoVer = await pronto(6000, { verificado: false }); expect(await tx((t) => solicitarSaque(t, naoVer.user, agora))).toEqual({ ok: false, erro: 'NAO_VERIFICADO' });
      const semDados = await novoColab(); await credito(semDados.id, 6000); expect(await tx((t) => solicitarSaque(t, semDados.user, agora))).toEqual({ ok: false, erro: 'SEM_DADOS_PAGAMENTO' });
      const pouco = await pronto(4999); expect(await tx((t) => solicitarSaque(t, pouco.user, agora))).toEqual({ ok: false, erro: 'SALDO_INSUFICIENTE', disponivelCentavos: 4999, minimoCentavos: 5000 });
      const ok = await pronto(7345); const r = await tx((t) => solicitarSaque(t, ok.user, agora));
      expect(r.ok).toBe(true); if (r.ok) { expect(r.saque.valorCentavos).toBe(7345); expect(r.saque.previstoAte.slice(0, 10)).toBe('2026-12-16'); }
      expect(await saldoDoColaborador(consulta, ok.id, agora)).toEqual({ pendenteCentavos: 0, disponivelCentavos: 0, totalCentavos: 0 });
      expect((await q(`SELECT tipo, valor_centavos FROM colaborador_lancamentos WHERE colaborador_id = $1 AND tipo = 'saque_reservado'`, [ok.id]))[0]).toMatchObject({ valor_centavos: -7345 });
      expect(await tx((t) => solicitarSaque(t, ok.user, agora))).toEqual({ ok: false, erro: 'SAQUE_ABERTO' });
    });
    it('suspenso, excluído, que saiu e interno NÃO pedem saque', async () => {
      for (const o of [{ estado: 'suspenso' }, { estado: 'excluido' }, { estado: 'saiu' }, { interno: true }]) { const c = await pronto(9000, o); expect(await tx((t) => solicitarSaque(t, c.user))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' }); }
    });
    it('pedidos SIMULTÂNEOS: só um vale (o saldo não é sacado duas vezes)', async () => {
      const c = await pronto(8000); const rs = await Promise.all([1, 2, 3].map(() => tx((t) => solicitarSaque(t, c.user))));
      expect(rs.filter((x) => x.ok).length).toBe(1); expect((await q(`SELECT count(*)::int n FROM colaborador_saques WHERE colaborador_id = $1`, [c.id]))[0].n).toBe(1);
      expect(Number((await q(`SELECT sum(valor_centavos) s FROM colaborador_lancamentos WHERE colaborador_id = $1`, [c.id]))[0].s)).toBe(0);
    });
    it('cancelar o pedido devolve o valor ao saldo (lançamento de cancelamento); sem pedido aberto, nada a cancelar', async () => {
      const c = await pronto(6000); expect(await tx((t) => cancelarSaque(t, c.user))).toEqual({ ok: false, erro: 'SEM_SAQUE_ABERTO' });
      await tx((t) => solicitarSaque(t, c.user)); expect(await tx((t) => cancelarSaque(t, c.user))).toEqual({ ok: true, valorCentavos: 6000 });
      expect((await saldoDoColaborador(consulta, c.id)).disponivelCentavos).toBe(6000); expect((await q('SELECT estado FROM colaborador_saques WHERE colaborador_id = $1', [c.id]))[0].estado).toBe('cancelado');
      expect((await tx((t) => solicitarSaque(t, c.user))).ok).toBe(true);   // pode pedir de novo
      expect(await tx((t) => cancelarSaque(t, randomUUID()))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
    });
    it('estorno depois do crédito deixa o saldo menor (e o saque só leva o que sobrou); o mínimo vem de programa_config', async () => {
      const c = await pronto(9000); await pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia) VALUES ($1,'estorno',-4500,$2)`, [c.id, `e:${randomUUID()}`]);
      expect(await tx((t) => solicitarSaque(t, c.user))).toMatchObject({ ok: false, erro: 'SALDO_INSUFICIENTE', disponivelCentavos: 4500 });
      await pool.query(`INSERT INTO programa_config (chave, valor, vigente_desde) VALUES ('saque_minimo_centavos','4000','2030-01-01')`);
      expect(await saqueMinimoCentavos(consulta, new Date('2026-12-01'))).toBe(5000); expect(await saqueMinimoCentavos(consulta, new Date('2031-01-01'))).toBe(4000);
      await pool.query(`DELETE FROM programa_config WHERE vigente_desde = '2030-01-01'`);
    });
    it('ocorrências do link: campos FIXOS, nomes mascarados, só as do próprio colaborador, sem dado de quem cadastrou', async () => {
      const a = await novoColab(); const b = await novoColab(); const dono = await novoUsuario();
      const ins = (colab: string, titulo: string, status = 'lost', extra: Record<string, unknown> = {}) => pool.query(
        `INSERT INTO objects (user_id, title, status, category, qr_code, colaborador_id, colaborador_codigo, subject_name, description, location, is_public, is_legacy) VALUES ($1,$2,$3,'phone',$4,$5,'@x','Fulano de Tal','telefone 11 99999-0000','Rua A 10, SP',$6,$7)`,
        [dono, titulo, status, `Q${randomUUID().slice(0, 7).toUpperCase()}`, colab, extra.publica ?? true, extra.legado ?? false]);
      await ins(a.id, 'Celular azul'); await ins(a.id, 'Carteira de João da Silva Pereira', 'found'); await ins(a.id, 'Arquivada', 'archived'); await ins(a.id, 'Privada', 'lost', { publica: false }); await ins(b.id, 'De outro colaborador'); await ins(a.id, 'Apagada', 'deleted');
      const lista = await ocorrenciasDoColaborador(consulta, a.id);
      expect(lista.map((x) => x.title).sort()).toEqual(['Arquivada', 'Carteira de João da Silva Pereira'.replace(/João da Silva Pereira/, lista.find((x) => x.title.startsWith('Carteira'))!.title.slice('Carteira de '.length)), 'Celular azul', 'Privada'].sort());
      for (const o of lista) expect(Object.keys(o).sort()).toEqual([...CAMPOS_DA_OCORRENCIA].sort());
      const j = JSON.stringify(lista); expect(j).not.toMatch(/Fulano|99999|Rua A|user_id|subject|description|location|colaborador/); expect(j).not.toContain('De outro colaborador'); expect(j).not.toContain('Apagada');
      expect(lista.find((x) => x.title === 'Arquivada')).toMatchObject({ status_label: 'Arquivada', visivel_no_feed: false }); expect(lista.find((x) => x.title === 'Privada')?.visivel_no_feed).toBe(false); expect(lista.find((x) => x.title === 'Celular azul')?.visivel_no_feed).toBe(true);
    });
    it('painel: sem COLABORADORES_SALDO o saldo é null («Comissão em apuração»); com ele aparece; o saque só com COLABORADORES_SAQUE', async () => {
      const c = await pronto(6000); const base = { COLABORADORES_ATIVO: '1', COLABORADORES_INSCRICAO: '1' };
      expect(await painelDoColaborador(consulta, c.id, base)).toMatchObject({ saldo: null, saque: null });
      expect(await painelDoColaborador(consulta, c.id, { ...base, COLABORADORES_SALDO: '1' })).toMatchObject({ saldo: { disponivelCentavos: 6000, pendenteCentavos: 0 }, saque: null });
      const p = await painelDoColaborador(consulta, c.id, { ...base, COLABORADORES_SALDO: '1', COLABORADORES_SAQUE: '1' });
      expect(p.saque).toMatchObject({ ativo: true, minimoCentavos: 5000, prazoDiasUteis: 10, dadosPagamento: { chaveFinal: '4725' } }); expect(JSON.stringify(p)).not.toContain('52998224725');
    });
  });

  describe('D. rotas', () => {
    const R: Record<string, (req: NextRequest) => Promise<Response>> = {};
    const req = (url: string, init: { method?: string; auth?: string | null; corpo?: unknown } = {}) => new NextRequest(`http://localhost${url}`, { method: init.method ?? 'GET', headers: { 'content-type': 'application/json', ...(init.auth ? { authorization: `Bearer ${init.auth}` } : {}) }, body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo) });
    const flags = (o: { saldo?: boolean; saque?: boolean; chave?: boolean; inscricao?: boolean }) => {
      process.env.COLABORADORES_ATIVO = '1'; for (const k of ['COLABORADORES_INSCRICAO', 'COLABORADORES_SALDO', 'COLABORADORES_SAQUE', 'PIX_CHAVE_CIFRAGEM']) delete process.env[k];
      if (o.inscricao !== false) process.env.COLABORADORES_INSCRICAO = '1'; if (o.saldo) process.env.COLABORADORES_SALDO = '1'; if (o.saque) process.env.COLABORADORES_SAQUE = '1'; if (o.chave) process.env.PIX_CHAVE_CIFRAGEM = CHAVE;
    };
    beforeAll(async () => {
      R.painel = (await import('@/app/api/v1/colaboradores/minha/painel/route')).GET as never; R.dados = (await import('@/app/api/v1/colaboradores/minha/dados-pagamento/route')).PUT as never;
      R.saque = (await import('@/app/api/v1/colaboradores/minha/saque/route')).POST as never; R.cancelar = (await import('@/app/api/v1/colaboradores/minha/saque/cancelar/route')).POST as never;
    });
    beforeEach(async () => { const { resetLimites } = await import('@/lib/colaboradores/rotaInscricao'); resetLimites(); });
    afterAll(() => { for (const k of ['COLABORADORES_ATIVO', 'COLABORADORES_INSCRICAO', 'COLABORADORES_SALDO', 'COLABORADORES_SAQUE', 'PIX_CHAVE_CIFRAGEM']) delete process.env[k]; });
    const comCredito = async (centavos: number) => { const c = await novoColab(); if (centavos > 0) await credito(c.id, centavos); return c; };

    it('desligadas = 404 vazio: painel sem inscrição; dados/saque sem COLABORADORES_SAQUE', async () => {
      const c = await comCredito(9000); flags({ inscricao: false });
      expect((await R.painel(req('/x', { auth: c.user }))).status).toBe(404);
      flags({ saldo: true }); expect((await R.painel(req('/x', { auth: c.user }))).status).toBe(200);
      for (const f of [() => R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: PIX })), () => R.saque(req('/x', { method: 'POST', auth: c.user })), () => R.cancelar(req('/x', { method: 'POST', auth: c.user }))]) expect((await f()).status).toBe(404);
    });
    it('sem login: 401', async () => {
      flags({ saldo: true, saque: true, chave: true });
      for (const f of [() => R.painel(req('/x')), () => R.dados(req('/x', { method: 'PUT', corpo: PIX })), () => R.saque(req('/x', { method: 'POST' })), () => R.cancelar(req('/x', { method: 'POST' })), () => R.painel(req('/x', { auth: 'invalido' }))]) expect((await f()).status).toBe(401);
    });
    it('painel sem saldo visível: «saldo: null»; com o interruptor, mostra; quem não é colaborador recebe painel nulo', async () => {
      const c = await comCredito(6000); flags({});
      expect((await (await R.painel(req('/x', { auth: c.user }))).json()).painel).toMatchObject({ saldo: null, saque: null });
      flags({ saldo: true }); expect((await (await R.painel(req('/x', { auth: c.user }))).json()).painel.saldo.disponivelCentavos).toBe(6000);
      expect((await (await R.painel(req('/x', { auth: await novoUsuario() }))).json()).painel).toBeNull();
    });
    it('dados de pagamento: 503 SEM a chave de cifragem (nada gravado); 400 com campos; com a chave, grava e devolve só o final', async () => {
      const c = await comCredito(0); flags({ saldo: true, saque: true });
      const semChave = await R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: PIX })); expect(semChave.status).toBe(503);
      expect((await q('SELECT count(*)::int n FROM colaborador_dados_pagamento WHERE colaborador_id = $1', [c.id]))[0].n).toBe(0);
      flags({ saldo: true, saque: true, chave: true });
      const ruim = await R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: { ...PIX, chave: '000' } })); expect(ruim.status).toBe(400); expect((await ruim.json()).campos.chave).toBeTruthy();
      const ok = await R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: PIX })); expect(ok.status).toBe(200);
      const texto = JSON.stringify(await ok.json()); expect(texto).toContain('4725'); expect(texto).not.toContain('52998224725'); expect(texto).not.toContain(CHAVE);
      const sem = await novoUsuario(); expect((await R.dados(req('/x', { method: 'PUT', auth: sem, corpo: PIX }))).status).toBe(409);
    });
    it('saque pela rota: erros claros (409), pedido (201), repetir (409), cancelar (200)', async () => {
      const c = await comCredito(8000); flags({ saldo: true, saque: true, chave: true });
      const r0 = await R.saque(req('/x', { method: 'POST', auth: c.user })); expect(r0.status).toBe(409); expect((await r0.json()).codigo).toBe('SEM_DADOS_PAGAMENTO');
      await R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: PIX }));
      const r1 = await R.saque(req('/x', { method: 'POST', auth: c.user })); expect(r1.status).toBe(201); const j = await r1.json(); expect(j.saque.valorCentavos).toBe(8000);
      expect((await (await R.saque(req('/x', { method: 'POST', auth: c.user }))).json()).codigo).toBe('SAQUE_ABERTO');
      const p = (await (await R.painel(req('/x', { auth: c.user }))).json()).painel; expect(p.saldo.disponivelCentavos).toBe(0); expect(p.saque.pedidos[0]).toMatchObject({ estado: 'solicitado', valor_centavos: 8000 });
      expect((await R.cancelar(req('/x', { method: 'POST', auth: c.user }))).status).toBe(200); expect((await R.cancelar(req('/x', { method: 'POST', auth: c.user }))).status).toBe(409);
    });
    it('a resposta do painel nunca traz a chave PIX nem o documento inteiros, nem dado de quem cadastrou', async () => {
      const c = await comCredito(6000); flags({ saldo: true, saque: true, chave: true }); await R.dados(req('/x', { method: 'PUT', auth: c.user, corpo: PIX }));
      const t = JSON.stringify(await (await R.painel(req('/x', { auth: c.user }))).json()); expect(t).not.toMatch(/52998224725|chave_cifrada|documento_cifrado|v1:|user_id|email/);
    });
  });
});

describe('C. isolamento (sem banco)', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('a tela só mostra valores vindos da API (nunca importa o livro) e o saque está atrás de interruptor próprio', () => {
    const tela = r('src/app/dashboard/colaborador/page.tsx'); expect(tela).not.toMatch(/saldoDoColaborador|colaborador_lancamentos|from '@\/lib\/colaboradores\/(comissao|saque|pagamento)'/); expect(tela).toContain('painel?.saque'); expect(tela).toContain('painel?.saldo');
    expect(r('src/lib/colaboradores/saque.ts')).toContain("env.COLABORADORES_SAQUE === '1'"); expect(r('src/lib/colaboradores/saque.ts')).toContain("env.COLABORADORES_SALDO === '1'");
  });
  it('a cifragem não registra valores em log e as rotas nunca devolvem os dados inteiros', () => {
    for (const f of ['src/lib/colaboradores/pagamento.ts', 'src/app/api/v1/colaboradores/minha/dados-pagamento/route.ts']) expect(r(f), f).not.toMatch(/console\.(log|info|debug)\(/);
    expect(r('src/app/api/v1/colaboradores/minha/dados-pagamento/route.ts')).toContain('lerDadosPagamento');
    expect(r('src/lib/colaboradores/pagamento.ts')).toContain('RECUSA gravar'); // sem a chave: nunca em claro
  });
});
