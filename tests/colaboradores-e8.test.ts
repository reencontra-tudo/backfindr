// Programa de Colaboradores, E8: antifraude (sinais para ANÁLISE MANUAL), contador de visitas SEM IP/cookie/identificador e auditoria completa.
// A e E: sem banco. B, C e D: Postgres REAL (puladas sem TEST_DATABASE_URL); aplicam as migrations 026 a 031 sobre tabelas mínimas.
// ATENÇÃO: recria users, objects, boosts, colaboradores e as tabelas novas no banco de teste.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const adm = vi.hoisted(() => ({ papel: 'admin' as 'admin' | 'nao', id: '' }));
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => ({ sub: t }) }));
vi.mock('@/lib/adminGuard', async () => {
  const { NextResponse } = await import('next/server');
  return { requireAdmin: async () => (adm.papel === 'admin' ? { user: { id: adm.id, role: 'admin' } } : NextResponse.json({ error: 'Forbidden' }, { status: 403 })) };
});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { antifraudeAtivo, avaliarColaborador, avaliarCompra, decidirSinal, emailNormalizado, LIMIARES, listarSinais } from '@/lib/colaboradores/antifraude';
import { acimaDoTeto, registrarVisita, slugDeVisita, TETO_POR_MINUTO_E_NOME, visitasAtivas, visitasDoMes, zerarTeto } from '@/lib/colaboradores/visitas';
import { registrarComissaoSombra, saldoDoColaborador } from '@/lib/colaboradores/comissao';
import { criarInscricao, minhaColaboracao, reativarPagina, sairDoPrograma, trocarCanal, validarInscricao, decidirVerificacao } from '@/lib/colaboradores/inscricao';
import { cancelarSaque, salvarDadosPagamento, solicitarSaque } from '@/lib/colaboradores/saque';
import { validarDadosPagamento } from '@/lib/colaboradores/pagamento';
import { POLITICA_VERSAO } from '@/content/politicaColaboradores';

const ENV = { PIX_CHAVE_CIFRAGEM: randomBytes(32).toString('base64') };

describe('A. e-mail normalizado, limiares, interruptores e teto (sem banco)', () => {
  it('compara e-mail sem gravar: minúsculas, sem +etiqueta, sem pontos do Gmail; entradas ruins = null', () => {
    expect(emailNormalizado('Maria.Silva+promo@Gmail.com')).toBe('mariasilva@gmail.com'); expect(emailNormalizado('maria.silva@googlemail.com')).toBe('mariasilva@gmail.com');
    expect(emailNormalizado('  joao.p+x@empresa.com.br ')).toBe('joao.p@empresa.com.br');   // fora do Gmail os pontos contam
    for (const v of ['', 'sem-arroba', '@x.com', 'a@', null, undefined, 42]) expect(emailNormalizado(v), String(v)).toBeNull();
    expect(emailNormalizado('a.b@gmail.com')).toBe(emailNormalizado('ab+z@gmail.com')); expect(emailNormalizado('a.b@outro.com')).not.toBe(emailNormalizado('ab@outro.com'));
  });
  it('limiares do código', () => { expect(LIMIARES).toEqual({ compras_do_mesmo_pagador_30d: 3, contas_novas_7d: 5, ocorrencias_24h: 20 }); });
  it('interruptores próprios e dependentes de COLABORADORES_ATIVO', () => {
    expect(antifraudeAtivo({})).toBe(false); expect(antifraudeAtivo({ COLABORADORES_ATIVO: '1' })).toBe(false); expect(antifraudeAtivo({ COLABORADORES_ANTIFRAUDE: '1' })).toBe(false); expect(antifraudeAtivo({ COLABORADORES_ATIVO: '1', COLABORADORES_ANTIFRAUDE: '1' })).toBe(true);
    expect(visitasAtivas({})).toBe(false); expect(visitasAtivas({ COLABORADORES_VISITAS: '1' })).toBe(false); expect(visitasAtivas({ COLABORADORES_ATIVO: '1', COLABORADORES_VISITAS: '1' })).toBe(true); expect(visitasAtivas({ COLABORADORES_ATIVO: '1', COLABORADORES_VISITAS: 'true' })).toBe(false);
  });
  it('visitas: o @nome precisa ser válido; teto por minuto e por @nome (só o nome entra na chave)', () => {
    expect(slugDeVisita(' Grupo-ZL ')).toBe('grupo-zl'); for (const v of ['ab', 'a b', '', null, 5, '-x-', 'ação']) expect(slugDeVisita(v), String(v)).toBeNull();
    zerarTeto(); const t0 = 1_000_000; let barrado = 0; for (let i = 0; i < TETO_POR_MINUTO_E_NOME + 10; i++) if (acimaDoTeto('abc-def', t0)) barrado++;
    expect(barrado).toBe(10); expect(acimaDoTeto('outro-nome', t0)).toBe(false); expect(acimaDoTeto('abc-def', t0 + 61_000)).toBe(false);   // outra janela de 1 min recomeça
  });
});

describe.skipIf(!TEST_DB)('B/C/D. com Postgres real', () => {
  let pool: Pool;
  const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);
  const consulta = (t: string, p?: unknown[]) => pool.query(t, p);
  const tx = async <T>(f: (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const MIG = (n: string) => readFileSync(path.join(__dirname, `../src/db/migrations/${n}`), 'utf8');
  const usuario = async (email = `u-${randomUUID().slice(0, 8)}@exemplo.com`, criadoHa = '30 days') => { const id = randomUUID(); await pool.query(`INSERT INTO users (id, email, created_at) VALUES ($1,$2, now() - $3::interval)`, [id, email, criadoHa]); return id; };
  const colab = async (emailDoColab?: string, o: { verificado?: boolean } = {}) => {
    const user = await usuario(emailDoColab); const id = randomUUID();
    await pool.query(`INSERT INTO colaboradores (id, user_id, slug, codigo_curto, nome, estado, interno, verificado_em) VALUES ($1,$2,$3,$4,'Colab','ativo',FALSE,$5)`,
      [id, user, `c-${randomUUID().slice(0, 8)}`, randomUUID().replace(/[^2-9A-HJ-NP-Z]/gi, 'D').slice(0, 4).toUpperCase(), o.verificado === false ? null : new Date().toISOString()]);
    return { user, id };
  };
  /** Uma compra aprovada de Boost, de `comprador`, numa ocorrência do colaborador; devolve o pagamento. */
  async function compra(c: { id: string }, comprador: string, valor = 9.9) {
    const dono = await usuario(); const obj = randomUUID(); const pay = String(Math.floor(Math.random() * 1e11));
    await pool.query(`INSERT INTO objects (id, user_id, title, colaborador_id, colaborador_codigo) VALUES ($1,$2,'x',$3,'@x')`, [obj, dono, c.id]);
    await pool.query(`INSERT INTO boosts (object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at) VALUES ($1,$2,'boost_7','active',$3,'mercadopago',$4,now(), now() + interval '7 days')`, [obj, comprador, valor, pay]);
    return { pay, valor };
  }
  const lancarComissao = (pay: string, valor: number, agora?: Date) => tx((t) => registrarComissaoSombra(t, { paymentId: pay, status: 'approved', valorBruto: valor }, agora));
  const sinais = (colabId: string) => q('SELECT tipo, bloqueia, estado, detalhe, pagamento_ref FROM colaborador_sinais WHERE colaborador_id = $1 ORDER BY criado_em', [colabId]);
  const auditorias = (alvo: string) => q('SELECT acao, antes, depois, motivo, ator_id FROM auditoria WHERE alvo_id = $1 ORDER BY criado_em', [alvo]);
  const ligarAntifraude = () => { process.env.COLABORADORES_ATIVO = '1'; process.env.COLABORADORES_ANTIFRAUDE = '1'; };
  const desligarTudo = () => { for (const k of ['COLABORADORES_ATIVO', 'COLABORADORES_ANTIFRAUDE', 'COLABORADORES_VISITAS', 'COLABORADORES_INSCRICAO']) delete process.env[k]; };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS colaborador_sinais, colaborador_visitas_dia, auditoria, colaborador_saques, colaborador_dados_pagamento, colaborador_lancamentos, pagamento_eventos, programa_config, colaborador_verificacoes, politica_aceites, boosts, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY, email varchar, created_at timestamptz DEFAULT now())');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT 'lost', created_at timestamp DEFAULT now())");
    await pool.query(`CREATE TABLE boosts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid NOT NULL, user_id uuid NOT NULL, type varchar NOT NULL, status varchar NOT NULL, amount_paid numeric, provider varchar, provider_ref varchar, starts_at timestamptz, expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, active boolean NOT NULL DEFAULT true)`);
    for (const m of ['026_colaboradores.sql', '027_colaboradores_inscricao.sql', '028_colaboradores_comissao.sql', '029_colaboradores_saque.sql', '030_colaboradores_auditoria.sql', '031_colaboradores_antifraude_visitas.sql']) await pool.query(MIG(m));
  });
  beforeEach(() => { desligarTudo(); adm.papel = 'admin'; zerarTeto(); });
  afterAll(async () => { desligarTudo(); await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  describe('B. antifraude: sinais para análise manual', () => {
    it('a migration 031 é idempotente e cria as 2 tabelas', async () => {
      await pool.query(MIG('031_colaboradores_antifraude_visitas.sql'));
      expect((await q("SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('colaborador_sinais','colaborador_visitas_dia')"))[0].n).toBe(2);
    });
    it('DESLIGADO: nada é lido nem gravado nos sinais (o saldo funciona mesmo sem a tabela) e a comissão é lançada normalmente', async () => {
      const c = await colab(); const p = await compra(c, await usuario());
      await pool.query('ALTER TABLE colaborador_sinais RENAME TO sinais_x');
      try {
        expect((await lancarComissao(p.pay, p.valor, new Date('2026-12-01T12:00:00Z'))).resultado).toBe('lancado');
        expect((await saldoDoColaborador(consulta, c.id, new Date('2026-12-20T00:00:00Z'))).disponivelCentavos).toBe(247);   // sem consultar a tabela de sinais
      } finally { await pool.query('ALTER TABLE sinais_x RENAME TO colaborador_sinais'); }
      expect((await sinais(c.id)).length).toBe(0);
    });
    it('pagador com o MESMO e-mail do colaborador (mesmo escrito de outro jeito): sinal que RETÉM a comissão até o admin decidir; só números no detalhe', async () => {
      ligarAntifraude();
      const c = await colab('Maria.Silva@gmail.com'); const comprador = await usuario('mariasilva+boost@gmail.com'); const p = await compra(c, comprador);
      const agora = new Date('2026-12-01T12:00:00Z'); expect((await lancarComissao(p.pay, p.valor, agora)).resultado).toBe('lancado');
      const s = await sinais(c.id); expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ tipo: 'pagador_igual_colaborador', bloqueia: true, estado: 'aberto', pagamento_ref: p.pay });
      expect(JSON.stringify(s)).not.toMatch(/@|gmail|mariasilva/i);
      const depois = new Date('2026-12-20T00:00:00Z');
      expect(await saldoDoColaborador(consulta, c.id, depois)).toEqual({ pendenteCentavos: 247, disponivelCentavos: 0, totalCentavos: 247 });   // retida
      const admin = await usuario(); const id = String((await q('SELECT id FROM colaborador_sinais WHERE colaborador_id = $1', [c.id]))[0].id);
      expect(await tx((t) => decidirSinal(t, id, 'descartar', admin, ''))).toEqual({ ok: false, erro: 'MOTIVO_OBRIGATORIO' });
      expect(await tx((t) => decidirSinal(t, randomUUID(), 'descartar', admin, 'sem relação'))).toEqual({ ok: false, erro: 'NAO_ENCONTRADO' });
      expect(await tx((t) => decidirSinal(t, id, 'descartar', admin, 'pessoas diferentes, conferido'))).toEqual({ ok: true });
      expect(await tx((t) => decidirSinal(t, id, 'confirmar', admin, 'de novo'))).toEqual({ ok: false, erro: 'JA_DECIDIDO' });
      expect(await saldoDoColaborador(consulta, c.id, depois)).toEqual({ pendenteCentavos: 0, disponivelCentavos: 247, totalCentavos: 247 });   // liberada
      expect((await auditorias(id))[0]).toMatchObject({ acao: 'sinal_descartado', motivo: 'pessoas diferentes, conferido', ator_id: admin });
    });
    it('«confirmar» mantém a comissão RETIDA para sempre (só um ajuste do admin no livro a corrige)', async () => {
      ligarAntifraude();
      const c = await colab('igual@exemplo.com'); const p = await compra(c, await usuario('igual@exemplo.com')); await lancarComissao(p.pay, p.valor, new Date('2026-12-01T12:00:00Z'));
      const admin = await usuario(); const id = String((await q('SELECT id FROM colaborador_sinais WHERE colaborador_id = $1', [c.id]))[0].id);
      expect(await tx((t) => decidirSinal(t, id, 'confirmar', admin, 'autocompra comprovada'))).toEqual({ ok: true });
      expect((await saldoDoColaborador(consulta, c.id, new Date('2027-06-01T00:00:00Z'))).disponivelCentavos).toBe(0);
    });
    it('mesmo pagador na 3ª compra em 30 dias: sinal que retém ESSA comissão (as duas primeiras seguem normais)', async () => {
      ligarAntifraude(); const c = await colab(); const comprador = await usuario(); const agora = new Date();
      const [p1, p2, p3] = [await compra(c, comprador), await compra(c, comprador), await compra(c, comprador)];
      for (const p of [p1, p2, p3]) await lancarComissao(p.pay, p.valor, agora);
      const s = await sinais(c.id); expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ tipo: 'pagador_repetido', bloqueia: true, pagamento_ref: p3.pay }); expect(s[0].detalhe).toEqual({ compras_30d: 3, limiar: 3 });
      const futuro = new Date(agora.getTime() + 20 * 86_400_000);
      expect((await saldoDoColaborador(consulta, c.id, futuro)).disponivelCentavos).toBe(247 * 2); expect((await saldoDoColaborador(consulta, c.id, futuro)).pendenteCentavos).toBe(247);
    });
    it('compras de pagadores DIFERENTES e e-mails diferentes: nenhum sinal', async () => {
      ligarAntifraude(); const c = await colab('dono@a.com');
      for (let i = 0; i < 4; i++) { const p = await compra(c, await usuario()); await lancarComissao(p.pay, p.valor); }
      expect((await sinais(c.id)).length).toBe(0);
    });
    it('sinais do COLABORADOR (só avisam): contas recém-criadas usando o código e pico de 24 h; idempotentes; não retêm comissão', async () => {
      ligarAntifraude(); const c = await colab(); const agora = new Date();
      for (let i = 0; i < LIMIARES.contas_novas_7d; i++) { const novo = await usuario(undefined, '2 hours'); await pool.query(`INSERT INTO objects (user_id, title, colaborador_id, colaborador_codigo, created_at) VALUES ($1,'x',$2,'@x', now())`, [novo, c.id]); }
      const antigo = await usuario(); for (let i = 0; i < LIMIARES.ocorrencias_24h; i++) await pool.query(`INSERT INTO objects (user_id, title, colaborador_id, colaborador_codigo, created_at) VALUES ($1,'x',$2,'@x', now())`, [antigo, c.id]);
      expect((await tx((t) => avaliarColaborador(t, c.id, agora))).sort()).toEqual(['contas_novas_com_codigo', 'pico_de_ocorrencias']);
      expect(await tx((t) => avaliarColaborador(t, c.id, agora))).toEqual([]);   // idempotente
      expect((await sinais(c.id)).every((x) => x.bloqueia === false && x.estado === 'aberto')).toBe(true);
      const outro = await colab(); expect(await tx((t) => avaliarColaborador(t, outro.id, agora))).toEqual([]);   // poucos: nada
    });
    it('falha na análise NUNCA desfaz a comissão (ponto de salvamento) e a comissão continua lançada', async () => {
      ligarAntifraude(); const c = await colab(); const p = await compra(c, await usuario());
      await pool.query('ALTER TABLE colaborador_sinais RENAME TO sinais_x');
      try { expect((await lancarComissao(p.pay, p.valor)).resultado).toBe('lancado'); } finally { await pool.query('ALTER TABLE sinais_x RENAME TO colaborador_sinais'); }
      expect((await q('SELECT count(*)::int n FROM colaborador_lancamentos WHERE pagamento_ref = $1', [p.pay]))[0].n).toBe(1);
    });
    it('a fila lista só números e tipos (sem e-mail, nome de pessoa ou identificador do pagador)', async () => {
      ligarAntifraude(); const c = await colab('x@y.com'); const p = await compra(c, await usuario('x@y.com')); await lancarComissao(p.pay, p.valor);
      const fila = await listarSinais(consulta, 'aberto'); const meu = fila.filter((s) => s.slug === (q ? undefined : undefined) || true);
      expect(JSON.stringify(meu)).not.toMatch(/@y\.com|user_id|comprador|boost_id/i);
    });
  });

  describe('C. visitas: agregado, sem IP, cookie ou identificador', () => {
    it('conta por colaborador e dia (UTC); só colaborador ATIVO e não interno; @nome inexistente = nada', async () => {
      const c = await colab(); const slug = String((await q('SELECT slug FROM colaboradores WHERE id = $1', [c.id]))[0].slug);
      const dia = new Date('2026-12-05T10:00:00Z');
      expect(await registrarVisita(consulta, slug.toUpperCase(), dia)).toBe(false);   // a rota normaliza o @nome antes; aqui o texto exato é comparado em minúsculas pelo banco
      expect(await registrarVisita(consulta, slug, dia)).toBe(true); expect(await registrarVisita(consulta, slug, dia)).toBe(true); expect(await registrarVisita(consulta, slug, new Date('2026-12-06T00:00:01Z'))).toBe(true);
      expect(await registrarVisita(consulta, 'nao-existe-xyz', dia)).toBe(false);
      const linhas = await q('SELECT dia::text d, visitas FROM colaborador_visitas_dia WHERE colaborador_id = $1 ORDER BY dia', [c.id]); expect(linhas).toEqual([{ d: '2026-12-05', visitas: 2 }, { d: '2026-12-06', visitas: 1 }]);
      await pool.query(`UPDATE colaboradores SET estado = 'suspenso' WHERE id = $1`, [c.id]); expect(await registrarVisita(consulta, slug, dia)).toBe(false);
      const i = await colab(); await pool.query(`UPDATE colaboradores SET interno = TRUE WHERE id = $1`, [i.id]); expect(await registrarVisita(consulta, String((await q('SELECT slug FROM colaboradores WHERE id = $1', [i.id]))[0].slug), dia)).toBe(false);
    });
    it('contagens SIMULTÂNEAS não se perdem; o mês fecha nas fronteiras', async () => {
      const c = await colab(); const slug = String((await q('SELECT slug FROM colaboradores WHERE id = $1', [c.id]))[0].slug);
      await Promise.all(Array.from({ length: 12 }, () => registrarVisita(consulta, slug, new Date('2026-11-30T23:59:59Z'))));
      await registrarVisita(consulta, slug, new Date('2026-12-01T00:00:00Z'));
      expect((await visitasDoMes(consulta, '2026-11')).get(c.id)).toBe(12); expect((await visitasDoMes(consulta, '2026-12')).get(c.id)).toBe(1);
    });
    it('a tabela guarda SÓ colaborador, dia e número (nenhuma coluna de pessoa)', async () => {
      const cols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'colaborador_visitas_dia' ORDER BY column_name`)).map((x) => x.column_name);
      expect(cols).toEqual(['colaborador_id', 'dia', 'visitas']);
    });
    it('rota: 404 desligada; ligada responde SEMPRE 204 vazio (nem confirma se o @nome existe) e soma só quando existe', async () => {
      const POST = (await import('@/app/api/v1/colaboradores/visita/route')).POST;
      const chama = (corpo: unknown) => POST(new NextRequest('http://localhost/api/v1/colaboradores/visita', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'bf=1', 'x-forwarded-for': '203.0.113.9' }, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }));
      const c = await colab(); const slug = String((await q('SELECT slug FROM colaboradores WHERE id = $1', [c.id]))[0].slug);
      expect((await chama({ slug })).status).toBe(404);
      process.env.COLABORADORES_ATIVO = '1'; process.env.COLABORADORES_VISITAS = '1';
      for (const corpo of [{ slug }, { slug: 'nao-existe-xyz' }, { slug: 5 }, 'lixo', {}]) { const r = await chama(corpo); expect(r.status).toBe(204); expect(await r.text()).toBe(''); }
      expect(Number((await q('SELECT COALESCE(SUM(visitas),0)::int n FROM colaborador_visitas_dia WHERE colaborador_id = $1', [c.id]))[0].n)).toBe(1);
      for (let i = 0; i < TETO_POR_MINUTO_E_NOME + 5; i++) await chama({ slug });   // acima do teto: segue 204, mas não soma além dele
      expect(Number((await q('SELECT visitas n FROM colaborador_visitas_dia WHERE colaborador_id = $1', [c.id]))[0].n)).toBeLessThanOrEqual(TETO_POR_MINUTO_E_NOME);
      expect((await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'colaborador_visitas_dia' AND column_name ~ '(ip|cookie|agente|user|device|dispositivo)'`))[0].n).toBe(0);
    });
  });

  describe('D. auditoria completa: cada ação deixa rastro, sem dado sensível', () => {
    it('inscrição, verificação, troca de canal, saída e reativação (esta e a saída em UMA instrução: a mudança e o rastro juntos)', async () => {
      const user = await usuario(); const admin = await usuario(); const v = validarInscricao({ slug: `a-${randomUUID().slice(0, 8)}`, nome: 'Grupo', canal_url: 'https://www.facebook.com/g', aceite: true, politica_versao: POLITICA_VERSAO });
      if (!v.ok) throw new Error('x'); const r = await tx((t) => criarInscricao(t, user, v.dados)); if (!r.ok) throw new Error('x');
      const id = r.colaborador.id;
      expect((await auditorias(id))[0]).toMatchObject({ acao: 'inscricao_criada', ator_id: user, depois: { slug: v.dados.slug, politicaVersao: POLITICA_VERSAO } });
      const vid = String((await q('SELECT id FROM colaborador_verificacoes WHERE colaborador_id = $1', [id]))[0].id);
      await tx((t) => decidirVerificacao(t, vid, 'aprovar', admin, null)); expect((await auditorias(vid))[0]).toMatchObject({ acao: 'verificacao_aprovada', ator_id: admin, depois: { estado: 'aprovada', colaboradorId: id } });
      await tx((t) => trocarCanal(t, user, 'https://www.instagram.com/novo')); expect((await auditorias(id)).find((x) => x.acao === 'canal_trocado')).toMatchObject({ antes: { canalUrl: 'https://www.facebook.com/g' }, depois: { canalUrl: 'https://www.instagram.com/novo', verificado: false } });
      expect(await sairDoPrograma(consulta, user)).toBe(true); expect(await sairDoPrograma(consulta, user)).toBe(false);   // a 2ª não muda nada e NÃO audita de novo
      expect(await reativarPagina(consulta, user)).toBe(true);
      const acoes = (await auditorias(id)).map((x) => x.acao); expect(acoes).toEqual(['inscricao_criada', 'canal_trocado', 'colaborador_saiu', 'colaborador_reativou']);
      expect((await minhaColaboracao(consulta, user))?.estado).toBe('ativo');
    });
    it('dados de pagamento e saque: auditados SEM chave, documento ou valor sensível; saque solicitado e cancelado', async () => {
      const c = await colab(); await pool.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, pagamento_ref, base_centavos, percentual_aplicado, disponivel_em, chave_idempotencia) VALUES ($1,'comissao',7000,'pp1',28000,25,now() - interval '1 day',$2)`, [c.id, `c:${randomUUID()}`]);
      const d = validarDadosPagamento({ tipo_chave: 'cpf', chave: '529.982.247-25', titular_nome: 'Maria da Silva', documento: '529.982.247-25' }); if (!d.ok) throw new Error('x');
      await salvarDadosPagamento(consulta, c.id, d.dados, ENV);
      const a1 = await auditorias(c.id); expect(a1[0]).toMatchObject({ acao: 'dados_pagamento_atualizados', depois: { tipoChave: 'cpf', chaveFinal: '4725' } }); expect(JSON.stringify(a1)).not.toMatch(/52998224725|529\.982|Maria da Silva|v1:/);
      const s = await tx((t) => solicitarSaque(t, c.user)); if (!s.ok) throw new Error(JSON.stringify(s));
      expect((await auditorias(s.saque.id))[0]).toMatchObject({ acao: 'saque_solicitado', ator_id: c.user, depois: { valorCentavos: 7000 } });
      await tx((t) => cancelarSaque(t, c.user)); expect((await auditorias(s.saque.id)).map((x) => x.acao)).toEqual(['saque_solicitado', 'saque_cancelado_pelo_colaborador']);
    });
    it('a trilha segue só-INSERT (UPDATE, DELETE e TRUNCATE recusados)', async () => {
      const id = String((await q('SELECT id FROM auditoria LIMIT 1'))[0].id);
      await expect(pool.query(`UPDATE auditoria SET motivo = 'x' WHERE id = $1`, [id])).rejects.toThrow(/só aceita INSERT/); await expect(pool.query('DELETE FROM auditoria WHERE id = $1', [id])).rejects.toThrow(/só aceita INSERT/); await expect(pool.query('TRUNCATE auditoria')).rejects.toThrow(/só aceita INSERT/);
    });
  });

  describe('E8. rotas do admin', () => {
    const R: Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>> = {};
    const req = (url: string, init: { method?: string; corpo?: unknown } = {}) => new NextRequest(`http://localhost${url}`, { method: init.method ?? 'GET', headers: { 'content-type': 'application/json' }, body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo) });
    beforeAll(async () => {
      R.sinais = (await import('@/app/api/v1/admin/colaboradores/sinais/route')).GET as never; R.decidir = (await import('@/app/api/v1/admin/colaboradores/sinais/[id]/route')).POST as never;
      R.analise = (await import('@/app/api/v1/admin/colaboradores/analise/route')).POST as never; R.auditoria = (await import('@/app/api/v1/admin/colaboradores/auditoria/route')).GET as never;
      R.lista = (await import('@/app/api/v1/admin/colaboradores/lista/route')).GET as never; R.exportar = (await import('@/app/api/v1/admin/colaboradores/export/route')).GET as never;
    });
    it('sinais e análise: 404 sem COLABORADORES_ANTIFRAUDE; 403 sem admin; com tudo, fluxo completo', async () => {
      adm.id = await usuario(); process.env.COLABORADORES_ATIVO = '1';
      const id = randomUUID();
      for (const f of [() => R.sinais(req('/x')), () => R.decidir(req('/x', { method: 'POST', corpo: {} }), { params: { id } }), () => R.analise(req('/x', { method: 'POST', corpo: {} }))]) expect((await f()).status).toBe(404);
      ligarAntifraude(); adm.papel = 'nao';
      for (const f of [() => R.sinais(req('/x')), () => R.decidir(req('/x', { method: 'POST', corpo: {} }), { params: { id } }), () => R.analise(req('/x', { method: 'POST', corpo: {} }))]) expect((await f()).status).toBe(403);
      adm.papel = 'admin';
      const c = await colab('mesmo@ex.com'); const p = await compra(c, await usuario('mesmo@ex.com')); await lancarComissao(p.pay, p.valor);
      const fila = await (await R.sinais(req('/x?estado=aberto'))).json(); const meu = fila.sinais.find((s: { slug: string; pagamento_ref: string }) => s.pagamento_ref === p.pay); expect(meu).toMatchObject({ tipo: 'pagador_igual_colaborador', bloqueia: true });
      expect((await R.sinais(req('/x?estado=xyz'))).status).toBe(400);
      expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'talvez' } }), { params: { id: meu.id } })).status).toBe(400); expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'descartar' } }), { params: { id: meu.id } })).status).toBe(400);
      expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'descartar', motivo: 'conferido: pessoas diferentes' } }), { params: { id: meu.id } })).status).toBe(200); expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'confirmar', motivo: 'de novo' } }), { params: { id: meu.id } })).status).toBe(409);
      expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'descartar', motivo: 'x motivo' } }), { params: { id: 'nao-uuid' } })).status).toBe(400);
      expect((await R.analise(req('/x', { method: 'POST', corpo: { colaborador_id: 'nao-uuid' } }))).status).toBe(400); expect((await R.analise(req('/x', { method: 'POST', corpo: { colaborador_id: randomUUID() } }))).status).toBe(404);
      const an = await R.analise(req('/x', { method: 'POST', corpo: { colaborador_id: c.id } })); expect(an.status).toBe(200); expect((await an.json()).novos).toEqual([]);
    });
    it('auditoria: filtros validados, resposta em ordem do mais recente, 403 sem admin, 404 desligada', async () => {
      adm.id = await usuario(); delete process.env.COLABORADORES_ATIVO; expect((await R.auditoria(req('/x'))).status).toBe(404);
      process.env.COLABORADORES_ATIVO = '1'; adm.papel = 'nao'; expect((await R.auditoria(req('/x'))).status).toBe(403); adm.papel = 'admin';
      const j = await (await R.auditoria(req('/x?alvo_tipo=colaborador'))).json(); expect(j.ok).toBe(true); expect(j.auditoria.length).toBeGreaterThan(0); expect(j.auditoria.every((x: { alvo_tipo: string }) => x.alvo_tipo === 'colaborador')).toBe(true);
      const datas = j.auditoria.map((x: { criado_em: string }) => +new Date(x.criado_em)); expect([...datas].sort((a, b) => b - a)).toEqual(datas);
      for (const ruim of ['?acao=a;drop', "?alvo_id=' or 1=1", '?alvo_tipo=' + 'x'.repeat(81)]) expect((await R.auditoria(req(`/x${ruim}`))).status).toBe(400);
    });
    it('lista e CSV: coluna de visitas vazia/nula com o contador desligado; com ele ligado traz o número', async () => {
      adm.id = await usuario(); process.env.COLABORADORES_ATIVO = '1'; const c = await colab(); const slug = String((await q('SELECT slug FROM colaboradores WHERE id = $1', [c.id]))[0].slug); const mes = new Date().toISOString().slice(0, 7);
      let l = await (await R.lista(req(`/x?mes=${mes}`))).json(); expect(l.colaboradores.find((x: { id: string }) => x.id === c.id).visitas_no_mes).toBeNull();
      process.env.COLABORADORES_VISITAS = '1'; await registrarVisita(consulta, slug); await registrarVisita(consulta, slug);
      l = await (await R.lista(req(`/x?mes=${mes}`))).json(); expect(l.colaboradores.find((x: { id: string }) => x.id === c.id).visitas_no_mes).toBe(2);
      const csv = await (await R.exportar(req(`/x?mes=${mes}`))).text(); expect(csv).toContain('visitas_no_mes'); expect(csv).toContain(`"${slug}"`);
    });
  });
});

describe('E. isolamento e privacidade (sem banco)', () => {
  const r = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('as visitas NÃO leem IP, cookie nem cabeçalho (só o @nome) e não registram nada em log; o navegador envia sem cookies', () => {
    const rota = r('src/app/api/v1/colaboradores/visita/route.ts'); const lib = r('src/lib/colaboradores/visitas.ts'); const comp = r('src/components/colaboradores/RegistroDeVisita.tsx');
    for (const [nome, src] of [['rota', rota], ['lib', lib]] as const) { expect(src, nome).not.toMatch(/headers\.get|req\.headers|cookies\(|req\.cookies|x-forwarded|clientIp|remoteAddress|user-agent|console\.(log|info|debug|warn|error)\(/i); }
    expect(comp).toContain("credentials: 'omit'"); expect(comp).not.toMatch(/localStorage|sessionStorage|document\.cookie|navigator\.userAgent/);
  });
  it('o antifraude nunca grava e-mail: o detalhe dos sinais só leva rótulos e números', () => {
    const src = r('src/lib/colaboradores/antifraude.ts'); expect(src).toContain("detalhe: { comparacao: 'email_normalizado_igual' }"); expect(src).not.toMatch(/detalhe:[^}]*email\s*[:,]/);
  });
  it('a página do colaborador só inclui o contador com o interruptor ligado', () => {
    const p = r('src/app/colaborador/[slug]/page.tsx'); expect(p).toContain('visitasAtivas() && <RegistroDeVisita'); expect(p).not.toMatch(/colaborador_visitas_dia/);
  });
  it('o saldo só consulta os sinais com o antifraude ligado (parâmetro padrão = interruptor)', () => {
    const c = r('src/lib/colaboradores/comissao.ts'); expect(c).toContain('comSinais: boolean = antifraudeAtivo()'); expect(c).toContain("s.estado IN ('aberto','confirmado')");
  });
  it('rotas novas do admin passam pelo guarda único; o antifraude tem interruptor próprio', () => {
    for (const f of ['sinais', 'sinais/[id]', 'analise', 'auditoria']) expect(r(`src/app/api/v1/admin/colaboradores/${f}/route.ts`), f).toContain('guardaAdmin(req)');
    for (const f of ['sinais', 'sinais/[id]', 'analise']) expect(r(`src/app/api/v1/admin/colaboradores/${f}/route.ts`), f).toContain('antifraudeAtivo()');
  });
});
