// Programa de Colaboradores, E5 (autoatendimento): validação, inscrição, aceite da política, verificação do canal, saída/reativação, rotas e páginas.
// Partes A, D e E: sem banco. Parte B e C: Postgres REAL (sem TEST_DATABASE_URL são puladas); aplicam as migrations 026 e 027 sobre tabelas mínimas.
// ATENÇÃO: recria users, objects, colaboradores e as tabelas da 027 no banco de teste.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import * as ReactNS from 'react';
(globalThis as { React?: unknown }).React = ReactNS;

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

const adm = vi.hoisted(() => ({ papel: 'admin' as 'admin' | 'nao', id: '' }));
vi.mock('@/lib/jwt', () => ({ extractTokenFromHeader: (h: string | null) => (h?.startsWith('Bearer ') ? h.slice(7) : null), verifyToken: (t: string) => (t === 'invalido' ? null : { sub: t }) }));
vi.mock('@/lib/adminGuard', async () => {
  const { NextResponse } = await import('next/server');
  return { requireAdmin: async () => (adm.papel === 'admin' ? { user: { id: adm.id, role: 'admin' } } : NextResponse.json({ error: 'Forbidden' }, { status: 403 })) };
});
const r2 = vi.hoisted(() => ({ enviados: [] as unknown[] }));
vi.mock('@/lib/storage', () => ({ uploadToR2: async (a: unknown) => { r2.enviados.push(a); return { key: 'partners/x.png', url: 'https://cdn.exemplo-r2.dev/partners/x.png' }; } }));
vi.spyOn(console, 'error').mockImplementation(() => {});

import {
  ALFABETO, SLUGS_RESERVADOS, gerarCodigoCurto, gerarCodigoVerificacao, imagemPropria, inscricaoAtiva, problemaDoSlug, validarInscricao,
  criarInscricao, disponibilidadeDoSlug, minhaColaboracao, sairDoPrograma, reativarPagina, trocarCanal, decidirVerificacao, listarVerificacoes, TEXTO_COMISSAO_EM_APURACAO,
} from '@/lib/colaboradores/inscricao';
import { tipoDaImagem, LIMITE_IMAGEM_BYTES } from '@/lib/colaboradores/imagem';
import { POLITICA_VERSAO } from '@/content/politicaColaboradores';

const OK = { slug: 'Grupo-Zona-Leste', nome: '  Animais  Perdidos ZL ', descricao: 'Ajudamos a reencontrar pets.', canal_url: 'https://www.facebook.com/groups/zonaleste', aceite: true, politica_versao: POLITICA_VERSAO };

describe('A. validação da inscrição (sem banco)', () => {
  it('aceita um pedido correto e normaliza (@, caixa, espaços)', () => {
    const v = validarInscricao({ ...OK, slug: '@Grupo-Zona-Leste' }); expect(v.ok).toBe(true);
    if (v.ok) expect(v.dados).toEqual({ slug: 'grupo-zona-leste', nome: 'Animais Perdidos ZL', descricao: 'Ajudamos a reencontrar pets.', canalUrl: 'https://www.facebook.com/groups/zonaleste', imagemUrl: null });
  });
  it('o ACEITE da política é obrigatório, explícito e da versão vigente (nunca presumido)', () => {
    for (const aceite of [undefined, false, 'true', 1, null]) { const v = validarInscricao({ ...OK, aceite }); expect(v.ok).toBe(false); if (!v.ok) expect(v.erros.aceite).toBeTruthy(); }
    const v = validarInscricao({ ...OK, politica_versao: '2000-01-01' }); expect(v.ok).toBe(false);
    expect(validarInscricao({ ...OK, politica_versao: undefined }).ok).toBe(false);
  });
  it('@nome: formato, reservados (rotas do site e a marca) e tamanho', () => {
    for (const s of ['ab', 'a'.repeat(31), '-abc', 'abc-', 'com espaço', 'ação', 'a_b_c', '']) expect(problemaDoSlug(s), s).toBeTruthy();
    for (const s of ['backfindr', 'admin', 'feed', 'api', 'seja', 'politica', 'dashboard', 'colaborador']) { expect(SLUGS_RESERVADOS.has(s)).toBe(true); expect(problemaDoSlug(s), s).toBeTruthy(); }
    expect(problemaDoSlug('animais-zl')).toBeNull();
  });
  it('nome, descrição, canal e imagem', () => {
    const e = (o: Record<string, unknown>) => { const v = validarInscricao({ ...OK, ...o }); return v.ok ? {} : v.erros; };
    expect(e({ nome: 'A' }).nome).toBeTruthy(); expect(e({ nome: 'x'.repeat(81) }).nome).toBeTruthy(); expect(e({ nome: undefined }).nome).toBeTruthy();
    expect(e({ descricao: 'd'.repeat(501) }).descricao).toBeTruthy();
    for (const c of ['http://x.com/g', 'javascript:alert(1)', 'facebook.com/g', 'https://user:pw@x.com', '', undefined]) expect(e({ canal_url: c }).canal_url, String(c)).toBeTruthy();
    expect(e({ canal_url: 'https://backfindr.com/@outro' }).canal_url).toBeTruthy();
    expect(e({ imagem_url: 'https://site-externo.com/logo.png' }).imagem_url).toBeTruthy();
  });
  it('só aceita imagem PRÓPRIA (backfindr.com ou o R2 do projeto), nunca link externo', () => {
    const env = { R2_PUBLIC_URL: 'https://cdn.exemplo-r2.dev' };
    expect(imagemPropria('https://cdn.exemplo-r2.dev/partners/a.png', env)).toBe(true); expect(imagemPropria('https://backfindr.com/x.png', env)).toBe(true);
    expect(imagemPropria('https://outro.dev/a.png', env)).toBe(false); expect(imagemPropria('http://cdn.exemplo-r2.dev/a.png', env)).toBe(false); expect(imagemPropria('https://cdn.exemplo-r2.dev.evil.com/a.png', env)).toBe(false);
    expect(imagemPropria('https://cdn.exemplo-r2.dev/a.png', {})).toBe(false);
  });
  it('texto livre: tira caracteres de controle e de inversão de texto', () => {
    const v = validarInscricao({ ...OK, nome: 'Grupo‮oir\u0000 X' }); expect(v.ok).toBe(true); if (v.ok) expect(v.dados.nome).toBe('Grupooir X');
  });
  it('códigos: alfabeto sem 0/O/1/I; verificação no formato BF-XXXX-XXXX', () => {
    expect(ALFABETO).not.toMatch(/[01OI]/); for (let i = 0; i < 200; i++) { expect(gerarCodigoCurto()).toMatch(/^[2-9A-HJ-NP-Z]{4}$/); expect(gerarCodigoVerificacao()).toMatch(/^BF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/); }
    expect(new Set(Array.from({ length: 50 }, () => gerarCodigoVerificacao())).size).toBeGreaterThan(45);
  });
  it('interruptor: só com COLABORADORES_ATIVO=1 E COLABORADORES_INSCRICAO=1', () => {
    expect(inscricaoAtiva({})).toBe(false); expect(inscricaoAtiva({ COLABORADORES_ATIVO: '1' })).toBe(false); expect(inscricaoAtiva({ COLABORADORES_INSCRICAO: '1' })).toBe(false);
    expect(inscricaoAtiva({ COLABORADORES_ATIVO: '1', COLABORADORES_INSCRICAO: '1' })).toBe(true); expect(inscricaoAtiva({ COLABORADORES_ATIVO: '1', COLABORADORES_INSCRICAO: 'true' })).toBe(false);
  });
});

describe('E. imagem (sem banco)', () => {
  it('confere o tipo pelos primeiros bytes', () => {
    expect(tipoDaImagem(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]))).toBe('image/png');
    expect(tipoDaImagem(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]))).toBe('image/jpeg');
    expect(tipoDaImagem(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))).toBe('image/webp');
    expect(tipoDaImagem(Buffer.from('<svg onload=alert(1)>'))).toBeNull(); expect(tipoDaImagem(Buffer.from('GIF89a......'))).toBeNull(); expect(LIMITE_IMAGEM_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe.skipIf(!TEST_DB)('B. banco real: inscrição, verificação, saída e reativação', () => {
  let pool: Pool;
  const novoUsuario = async () => { const id = randomUUID(); await pool.query('INSERT INTO users (id) VALUES ($1)', [id]); return id; };
  const dados = (over: Record<string, unknown> = {}) => { const v = validarInscricao({ ...OK, slug: `g-${randomUUID().slice(0, 8)}`, ...over }); if (!v.ok) throw new Error(JSON.stringify(v.erros)); return v.dados; };
  const tx = async <T>(f: (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const q = (t: string, p: unknown[] = []) => pool.query(t, p).then((r) => r.rows);

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS auditoria, colaborador_verificacoes, politica_aceites, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await pool.query('CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT \'lost\', created_at timestamp DEFAULT now())');
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/027_colaboradores_inscricao.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/030_colaboradores_auditoria.sql'), 'utf8')); // E8: a inscrição e o resto agora gravam auditoria
  });
  afterAll(async () => { await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  it('a migration 027 é idempotente (rodar de novo não falha nem duplica)', async () => {
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/027_colaboradores_inscricao.sql'), 'utf8'));
    expect((await q("SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN ('politica_aceites','colaborador_verificacoes')"))[0].n).toBe(2);
  });
  it('inscrição: cria colaborador ATIVO, NÃO verificado, NÃO interno, com aceite da versão e verificação pendente (mesma transação)', async () => {
    const u = await novoUsuario(); const d = dados();
    const r = await tx((c) => criarInscricao(c, u, d)); expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = (await q('SELECT * FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0];
    expect(c).toMatchObject({ slug: d.slug, estado: 'ativo', interno: false, modalidade: 'comunidade_criador', verificado_em: null, user_id: u });
    expect(String(c.codigo_curto)).toMatch(/^[2-9A-HJ-NP-Z]{4}$/);
    expect((await q('SELECT versao FROM politica_aceites WHERE user_id = $1', [u]))[0].versao).toBe(POLITICA_VERSAO);
    const v = (await q('SELECT * FROM colaborador_verificacoes WHERE colaborador_id = $1', [r.colaborador.id]))[0];
    expect(v).toMatchObject({ estado: 'pendente', canal_url: d.canalUrl }); expect(String(v.codigo)).toMatch(/^BF-/); expect(r.verificacao.codigo).toBe(v.codigo);
  });
  it('um colaborador por conta; @nome único sem diferenciar maiúscula; corrida pelo mesmo @nome = um só vence', async () => {
    const u = await novoUsuario(); const d = dados();
    expect((await tx((c) => criarInscricao(c, u, d))).ok).toBe(true);
    const outraDaMesma = await tx((c) => criarInscricao(c, u, dados())); expect(outraDaMesma).toEqual({ ok: false, erro: 'JA_E_COLABORADOR' });
    const u2 = await novoUsuario(); const mesmoNome = await tx((c) => criarInscricao(c, u2, { ...d })); // mesmo @nome (o banco ainda compara sem diferenciar maiúscula: índice em lower(slug))
    expect(mesmoNome).toEqual({ ok: false, erro: 'SLUG_INDISPONIVEL' });
    const [a, b] = [await novoUsuario(), await novoUsuario()]; const slug = `corrida-${randomUUID().slice(0, 6)}`;
    const res = await Promise.all([tx((c) => criarInscricao(c, a, dados({ slug }))), tx((c) => criarInscricao(c, b, dados({ slug })))]);
    expect(res.filter((x) => x.ok).length).toBe(1); expect(res.filter((x) => !x.ok && x.erro === 'SLUG_INDISPONIVEL').length).toBe(1);
    expect((await q('SELECT count(*)::int n FROM colaboradores WHERE lower(slug) = $1', [slug]))[0].n).toBe(1);
  });
  it('falha no meio não deixa nada pela metade (sem colaborador órfão, sem aceite)', async () => {
    const u = await novoUsuario(); await pool.query('ALTER TABLE colaborador_verificacoes RENAME TO verif_x');
    await expect(tx((c) => criarInscricao(c, u, dados()))).rejects.toBeTruthy();
    await pool.query('ALTER TABLE verif_x RENAME TO colaborador_verificacoes');
    expect((await q('SELECT count(*)::int n FROM colaboradores WHERE user_id = $1', [u]))[0].n).toBe(0); expect((await q('SELECT count(*)::int n FROM politica_aceites WHERE user_id = $1', [u]))[0].n).toBe(0);
  });
  it('disponibilidade do @nome: formato, reservado, em uso, livre', async () => {
    const u = await novoUsuario(); const d = dados(); await tx((c) => criarInscricao(c, u, d));
    expect((await disponibilidadeDoSlug(pool.query.bind(pool), d.slug.toUpperCase())).disponivel).toBe(false);
    expect((await disponibilidadeDoSlug(pool.query.bind(pool), 'backfindr')).disponivel).toBe(false);
    expect((await disponibilidadeDoSlug(pool.query.bind(pool), 'x')).disponivel).toBe(false);
    expect((await disponibilidadeDoSlug(pool.query.bind(pool), `livre-${randomUUID().slice(0, 6)}`)).disponivel).toBe(true);
  });
  it('minha colaboração: dados, verificação pendente e «Comissão em apuração» (sem valores)', async () => {
    const u = await novoUsuario(); const d = dados(); await tx((c) => criarInscricao(c, u, d));
    const m = await minhaColaboracao(pool.query.bind(pool), u, 'https://backfindr.com'); expect(m).toBeTruthy();
    expect(m).toMatchObject({ slug: d.slug, estado: 'ativo', verificado: false, interno: false, comissao: TEXTO_COMISSAO_EM_APURACAO, linkPublico: `https://backfindr.com/@${d.slug}` });
    expect(m?.verificacao?.estado).toBe('pendente'); expect(JSON.stringify(m)).not.toMatch(/R\$|centavos|saldo/i);
    expect(await minhaColaboracao(pool.query.bind(pool), await novoUsuario())).toBeNull();
  });
  it('verificação: aprovar libera verificado_em; recusar exige motivo; decisão só uma vez', async () => {
    const u = await novoUsuario(); const admin = await novoUsuario(); const r = await tx((c) => criarInscricao(c, u, dados())); if (!r.ok) throw new Error('x');
    const vid = String((await q('SELECT id FROM colaborador_verificacoes WHERE colaborador_id = $1', [r.colaborador.id]))[0].id);
    expect((await listarVerificacoes(pool.query.bind(pool))).some((x) => x.id === vid)).toBe(true);
    expect(await tx((c) => decidirVerificacao(c, vid, 'recusar', admin, null))).toEqual({ ok: false, erro: 'MOTIVO_OBRIGATORIO' });
    expect(await tx((c) => decidirVerificacao(c, randomUUID(), 'aprovar', admin, null))).toEqual({ ok: false, erro: 'NAO_ENCONTRADA' });
    expect(await tx((c) => decidirVerificacao(c, vid, 'aprovar', admin, null))).toEqual({ ok: true });
    const c = (await q('SELECT verificado_em, verificado_por FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0]; expect(c.verificado_em).toBeTruthy(); expect(c.verificado_por).toBe(admin);
    expect(await tx((c2) => decidirVerificacao(c2, vid, 'recusar', admin, 'x'))).toEqual({ ok: false, erro: 'JA_DECIDIDA' });
  });
  it('troca de canal: nova verificação, a anterior vira «substituída» e a liberação (verificado_em) volta a ficar suspensa', async () => {
    const u = await novoUsuario(); const admin = await novoUsuario(); const r = await tx((c) => criarInscricao(c, u, dados())); if (!r.ok) throw new Error('x');
    const v1 = String((await q('SELECT id FROM colaborador_verificacoes WHERE colaborador_id = $1', [r.colaborador.id]))[0].id);
    await tx((c) => decidirVerificacao(c, v1, 'aprovar', admin, null));
    expect((await q('SELECT verificado_em FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0].verificado_em).toBeTruthy();
    expect(await tx((c) => trocarCanal(c, u, 'http://inseguro.com'))).toEqual({ ok: false, erro: 'CANAL_INVALIDO' });
    expect(await tx((c) => trocarCanal(c, u, 'https://backfindr.com/@x'))).toEqual({ ok: false, erro: 'CANAL_INVALIDO' });
    const t = await tx((c) => trocarCanal(c, u, 'https://www.instagram.com/novo')); expect(t.ok).toBe(true);
    const col = (await q('SELECT canal_url, verificado_em FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0]; expect(col.verificado_em).toBeNull(); expect(col.canal_url).toBe('https://www.instagram.com/novo');
    const vs = await q('SELECT estado FROM colaborador_verificacoes WHERE colaborador_id = $1 ORDER BY criado_em', [r.colaborador.id]);
    expect(vs.map((x) => x.estado)).toEqual(['aprovada', 'pendente']);
    const t2 = await tx((c) => trocarCanal(c, u, 'https://www.instagram.com/novo2')); expect(t2.ok).toBe(true);
    expect((await q("SELECT count(*)::int n FROM colaborador_verificacoes WHERE colaborador_id = $1 AND estado = 'pendente'", [r.colaborador.id]))[0].n).toBe(1);
  });
  it('sair e reativar: saída voluntária (saiu_em); só quem SAIU reativa; suspenso, excluído e interno não', async () => {
    const u = await novoUsuario(); const r = await tx((c) => criarInscricao(c, u, dados())); if (!r.ok) throw new Error('x');
    expect(await reativarPagina(pool.query.bind(pool), u)).toBe(false);          // ativo: nada a reativar
    expect(await sairDoPrograma(pool.query.bind(pool), u)).toBe(true);
    const c = (await q('SELECT estado, saiu_em FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0]; expect(c.estado).toBe('saiu'); expect(c.saiu_em).toBeTruthy();
    expect(await sairDoPrograma(pool.query.bind(pool), u)).toBe(false);
    expect(await reativarPagina(pool.query.bind(pool), u)).toBe(true);
    expect((await q('SELECT estado, saiu_em FROM colaboradores WHERE id = $1', [r.colaborador.id]))[0]).toMatchObject({ estado: 'ativo', saiu_em: null });
    await pool.query("UPDATE colaboradores SET estado = 'suspenso' WHERE id = $1", [r.colaborador.id]); expect(await reativarPagina(pool.query.bind(pool), u)).toBe(false);
    await pool.query("UPDATE colaboradores SET estado = 'excluido' WHERE id = $1", [r.colaborador.id]); expect(await reativarPagina(pool.query.bind(pool), u)).toBe(false);
    const ui = await novoUsuario(); await pool.query("INSERT INTO colaboradores (user_id, slug, codigo_curto, nome, interno) VALUES ($1, 'interno-x', 'ZZ22', 'Interno', TRUE)", [ui]);
    expect(await sairDoPrograma(pool.query.bind(pool), ui)).toBe(false);
  });
  it('a linha do colaborador continua sem poder ser apagada; o aceite é um por pessoa e versão', async () => {
    const u = await novoUsuario(); const r = await tx((c) => criarInscricao(c, u, dados())); if (!r.ok) throw new Error('x');
    await expect(pool.query('DELETE FROM colaboradores WHERE id = $1', [r.colaborador.id])).rejects.toThrow(/nunca é apagada/);
    await expect(pool.query('INSERT INTO politica_aceites (user_id, versao) VALUES ($1, $2)', [u, POLITICA_VERSAO])).rejects.toThrow(/duplicate|uq_politica/);
  });
});

describe.skipIf(!TEST_DB)('C. rotas com banco real', () => {
  let pool: Pool;
  const R: Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>> = {};
  const req = (url: string, init: { method?: string; auth?: string | null; corpo?: unknown } = {}) => new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET', headers: { 'content-type': 'application/json', ...(init.auth ? { authorization: `Bearer ${init.auth}` } : {}) }, body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
  });
  const ligar = () => { process.env.COLABORADORES_ATIVO = '1'; process.env.COLABORADORES_INSCRICAO = '1'; };
  const desligar = () => { delete process.env.COLABORADORES_INSCRICAO; };
  const novoUsuario = async () => { const id = randomUUID(); await pool.query('INSERT INTO users (id) VALUES ($1)', [id]); return id; };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query('DROP TABLE IF EXISTS auditoria, colaborador_verificacoes, politica_aceites, objects, colaboradores, users CASCADE');
    await pool.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await pool.query("CREATE TABLE objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, title text, status text DEFAULT 'lost', created_at timestamp DEFAULT now())");
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/026_colaboradores.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/027_colaboradores_inscricao.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, '../src/db/migrations/030_colaboradores_auditoria.sql'), 'utf8'));
    R.inscricao = (await import('@/app/api/v1/colaboradores/inscricao/route')).POST as never;
    R.disp = (await import('@/app/api/v1/colaboradores/disponibilidade/route')).GET as never;
    R.minha = (await import('@/app/api/v1/colaboradores/minha/route')).GET as never;
    R.sair = (await import('@/app/api/v1/colaboradores/minha/sair/route')).POST as never;
    R.reativar = (await import('@/app/api/v1/colaboradores/minha/reativar/route')).POST as never;
    R.canal = (await import('@/app/api/v1/colaboradores/minha/canal/route')).POST as never;
    R.fila = (await import('@/app/api/v1/admin/colaboradores/verificacoes/route')).GET as never;
    R.decidir = (await import('@/app/api/v1/admin/colaboradores/verificacoes/[id]/route')).POST as never;
  });
  beforeEach(async () => { ligar(); adm.papel = 'admin'; const { resetLimites } = await import('@/lib/colaboradores/rotaInscricao'); resetLimites(); adm.id = await novoUsuario(); });
  afterAll(async () => { delete process.env.COLABORADORES_ATIVO; delete process.env.COLABORADORES_INSCRICAO; await pool?.end(); const { closePool } = await import('@/lib/db'); await closePool(); });

  it('DESLIGADA (sem COLABORADORES_INSCRICAO): todas as rotas respondem 404 vazio e nada é gravado', async () => {
    desligar(); const u = await novoUsuario();
    const respostas = await Promise.all([
      R.inscricao(req('/x', { method: 'POST', auth: u, corpo: OK })), R.disp(req('/x?slug=abc', { auth: u })), R.minha(req('/x', { auth: u })), R.sair(req('/x', { method: 'POST', auth: u })),
      R.reativar(req('/x', { method: 'POST', auth: u })), R.canal(req('/x', { method: 'POST', auth: u, corpo: { canal_url: 'https://a.com/b' } })), R.fila(req('/x')), R.decidir(req('/x', { method: 'POST', corpo: {} }), { params: { id: randomUUID() } }),
    ]);
    for (const r of respostas) expect(r.status).toBe(404);
    expect((await pool.query('SELECT count(*)::int n FROM colaboradores')).rows[0].n).toBe(0);
  });
  it('sem login: 401 em todas as rotas de usuário', async () => {
    for (const f of [() => R.inscricao(req('/x', { method: 'POST', corpo: OK })), () => R.disp(req('/x?slug=abc')), () => R.minha(req('/x')), () => R.sair(req('/x', { method: 'POST' })), () => R.reativar(req('/x', { method: 'POST' })), () => R.canal(req('/x', { method: 'POST', corpo: {} }))])
      expect((await f()).status).toBe(401);
    expect((await R.minha(req('/x', { auth: 'invalido' }))).status).toBe(401);
  });
  it('inscrição ponta a ponta: 201, depois «minha», disponibilidade, saída e reativação', async () => {
    const u = await novoUsuario(); const slug = `ponta-${randomUUID().slice(0, 6)}`;
    const r = await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, slug } })); expect(r.status).toBe(201);
    const j = await r.json(); expect(j.ok).toBe(true); expect(j.colaborador.slug).toBe(slug); expect(j.verificacao.codigo).toMatch(/^BF-/); expect(j.comissao).toBe('Comissão em apuração');
    const m = await (await R.minha(req('/x', { auth: u }))).json(); expect(m.colaborador.slug).toBe(slug); expect(m.colaborador.verificado).toBe(false);
    const d = await (await R.disp(req(`/x?slug=${slug}`, { auth: u }))).json(); expect(d.disponivel).toBe(false);
    expect((await R.sair(req('/x', { method: 'POST', auth: u }))).status).toBe(200); expect((await R.sair(req('/x', { method: 'POST', auth: u }))).status).toBe(409);
    expect((await R.reativar(req('/x', { method: 'POST', auth: u }))).status).toBe(200);
  });
  it('erros de campo (400 com `campos`), @nome em uso (409), segunda inscrição da conta (409)', async () => {
    const u = await novoUsuario(); const u2 = await novoUsuario(); const slug = `uso-${randomUUID().slice(0, 6)}`;
    const ruim = await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, aceite: false, canal_url: 'http://x' } })); expect(ruim.status).toBe(400);
    const cj = await ruim.json(); expect(cj.campos.aceite).toBeTruthy(); expect(cj.campos.canal_url).toBeTruthy();
    expect((await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, slug } }))).status).toBe(201);
    expect((await R.inscricao(req('/x', { method: 'POST', auth: u2, corpo: { ...OK, slug } }))).status).toBe(409);
    expect((await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, slug: `outro-${randomUUID().slice(0, 6)}` } }))).status).toBe(409);
    expect((await pool.query('SELECT count(*)::int n FROM politica_aceites WHERE user_id = $1', [u2])).rows[0].n).toBe(0);
  });
  it('limite: depois de 5 tentativas na hora, 429', async () => {
    const u = await novoUsuario(); let ultimo = 0;
    for (let i = 0; i < 6; i++) ultimo = (await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, aceite: false } }))).status;
    expect(ultimo).toBe(429);
  });
  it('troca de canal pela rota; canal inválido = 400', async () => {
    const u = await novoUsuario(); await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, slug: `canal-${randomUUID().slice(0, 6)}` } }));
    expect((await R.canal(req('/x', { method: 'POST', auth: u, corpo: { canal_url: 'ftp://x' } }))).status).toBe(400);
    expect((await R.canal(req('/x', { method: 'POST', auth: u, corpo: { canal_url: 'https://www.instagram.com/novo' } }))).status).toBe(200);
    const m = await (await R.minha(req('/x', { auth: u }))).json(); expect(m.colaborador.canalUrl).toBe('https://www.instagram.com/novo');
  });
  it('admin: fila de verificação e decisão; não-admin é barrado (403); aprovar libera o canal', async () => {
    const u = await novoUsuario(); await R.inscricao(req('/x', { method: 'POST', auth: u, corpo: { ...OK, slug: `fila-${randomUUID().slice(0, 6)}` } }));
    adm.papel = 'nao'; expect((await R.fila(req('/x'))).status).toBe(403);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'aprovar' } }), { params: { id: randomUUID() } })).status).toBe(403);
    adm.papel = 'admin';
    const fila = await (await R.fila(req('/x?estado=pendente'))).json(); const item = fila.verificacoes.find((v: { slug: string }) => v.slug.startsWith('fila-')); expect(item).toBeTruthy();
    expect((await R.fila(req('/x?estado=xyz'))).status).toBe(400);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'talvez' } }), { params: { id: item.id } })).status).toBe(400);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'recusar' } }), { params: { id: item.id } })).status).toBe(400);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'aprovar' } }), { params: { id: item.id } })).status).toBe(200);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'aprovar' } }), { params: { id: item.id } })).status).toBe(409);
    expect((await R.decidir(req('/x', { method: 'POST', corpo: { decisao: 'aprovar' } }), { params: { id: 'nao-uuid' } })).status).toBe(400);
    const m = await (await R.minha(req('/x', { auth: u }))).json(); expect(m.colaborador.verificado).toBe(true);
  });
});

describe('D. páginas e envio de imagem (sem banco)', () => {
  const ligar = () => { process.env.COLABORADORES_ATIVO = '1'; process.env.COLABORADORES_INSCRICAO = '1'; };
  const limpar = () => { delete process.env.COLABORADORES_ATIVO; delete process.env.COLABORADORES_INSCRICAO; };
  const erroDe = async (f: () => unknown) => { try { await f(); return null; } catch (e) { return e as { digest?: string }; } };
  const texto = (jsx: unknown) => { const visto = new WeakSet<object>(); return JSON.stringify(jsx, (k, v) => (typeof v === 'function' || k === '_owner' ? undefined : v && typeof v === 'object' ? (visto.has(v) ? undefined : (visto.add(v), v)) : v)); };

  it('/colaborador/seja e /colaborador/politica: 404 com o interruptor desligado; ligados, noindex e com o texto oficial', async () => {
    limpar();
    const seja = await import('@/app/colaborador/seja/page'); const pol = await import('@/app/colaborador/politica/page');
    expect((await erroDe(() => seja.default()))?.digest).toBe('NEXT_NOT_FOUND'); expect((await erroDe(() => pol.default()))?.digest).toBe('NEXT_NOT_FOUND');
    ligar();
    expect(JSON.stringify(seja.metadata.robots)).toContain('"index":false'); expect(JSON.stringify(pol.metadata.robots)).toContain('"index":false');
    const t = texto(seja.default());
    expect(t).toContain('O Programa de Colaboradores leva o Backfindr a mais pessoas'); expect(t).toContain('Comissão de 25%'); expect(t).toContain('Política do Programa de Colaboradores');
    limpar();
  });
  it('a inscrição não é linkada em menu, rodapé, sitemap nem robots (só por link)', () => {
    for (const f of ['src/components/home/Navbar.tsx', 'src/app/page.tsx', 'src/app/sitemap.ts', 'src/app/robots.ts', 'src/app/dashboard/layout.tsx']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/colaborador\/seja|colaborador\/politica|dashboard\/colaborador/);
  });
  it('envio de imagem: 404 desligado, 401 sem login, tipo/tamanho/magic bytes, e só então vai ao R2 (pasta partners)', async () => {
    const rota = (await import('@/app/api/v1/colaboradores/imagem/route')).POST; const { resetLimites } = await import('@/lib/colaboradores/rotaInscricao'); resetLimites();
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
    const chama = (corpo: unknown, auth: string | null = 'u1') => rota(new NextRequest('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(corpo) }));
    limpar(); expect((await chama({ imagem: `data:image/png;base64,${png.toString('base64')}` })).status).toBe(404);
    ligar();
    expect((await chama({ imagem: `data:image/png;base64,${png.toString('base64')}` }, null)).status).toBe(401);
    expect((await chama({ imagem: 'texto' })).status).toBe(400); expect((await chama({ imagem: 'data:image/gif;base64,AAAA' })).status).toBe(400);
    expect((await chama({ imagem: `data:image/png;base64,${Buffer.from('<svg onload=1>').toString('base64')}` })).status).toBe(400);
    expect((await chama({ imagem: `data:image/png;base64,${Buffer.concat([png, Buffer.alloc(LIMITE_IMAGEM_BYTES)]).toString('base64')}` })).status).toBe(413);
    expect(r2.enviados.length).toBe(0);
    const ok = await chama({ imagem: `data:image/png;base64,${png.toString('base64')}` }); expect(ok.status).toBe(200);
    expect((await ok.json()).url).toBe('https://cdn.exemplo-r2.dev/partners/x.png'); expect(r2.enviados.length).toBe(1);
    expect(r2.enviados[0]).toMatchObject({ folder: 'partners', mimeType: 'image/png' });
    limpar();
  });
});
