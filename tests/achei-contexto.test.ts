// «Informar que encontrei» leva o contexto do card ao /achei (?de=<código>). Sem banco: lógica pura, a rota com banco simulado e regras do código.
// Com banco real (TEST_DATABASE_URL): elegibilidade e indistinguibilidade da resposta.
//   npx vitest@2 run --config tests/vitest.config.ts tests/achei-contexto.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NextRequest } from 'next/server';

(globalThis as unknown as { React: typeof React }).React = React;

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import FeedClient from '@/app/feed/FeedClient';
import { acheiHref, buscarContexto, cadastroHref, codigoSelecionavel, lerDe, lerDeDaUrl, palavrasDoTitulo, validarContexto } from '@/lib/feed/contexto';
import AcheiClient from '@/app/achei/client';
import { LIMITE_POR_MINUTO } from '@/lib/feed/limite';
import { FEED_ELIGIBILITY_WHERE } from '@/lib/feed/query';

const read = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('leitura do parâmetro «de»', () => {
  it('aceita só código de letras, números, «-» e «_» (4 a 64)', () => {
    for (const ok of ['2HE93T6N', 'USR00001', 'abcd', 'a-b_c-1234', 'A'.repeat(64)]) expect(lerDe(ok), ok).toBe(ok);
    expect(lerDe('  USR00001 ')).toBe('USR00001');
  });
  it('vazio, nulo, curto, longo, com símbolos ou marcação: ignorado em silêncio (null)', () => {
    for (const ruim of [null, undefined, '', '   ', 'abc', 'A'.repeat(65), 'USR 00001', 'USR00001;DROP', "USR'--", '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', '../../etc/passwd', 'USR0000%0A1', 'çãõ123456', '${jndi:x}', '%3Cscript%3E'])
      expect(lerDe(ruim as string), String(ruim)).toBeNull();
  });
  it('da URL: um «de» válido; repetido, vazio, mal-formado ou com lixo = null', () => {
    expect(lerDeDaUrl('?ref=feed&de=USR00001')).toBe('USR00001');
    expect(lerDeDaUrl('?de=USR00001&de=USR00002')).toBeNull();
    expect(lerDeDaUrl('?ref=feed')).toBeNull(); expect(lerDeDaUrl('')).toBeNull(); expect(lerDeDaUrl(null)).toBeNull();
    expect(lerDeDaUrl('?de=')).toBeNull(); expect(lerDeDaUrl('?de=%3Cscript%3E')).toBeNull(); expect(lerDeDaUrl('?de=' + 'A'.repeat(500))).toBeNull();
    expect(lerDeDaUrl('?de[]=USR00001')).toBeNull();
  });
});

describe('links', () => {
  it('card → /achei?ref=feed&de=<código> (com encoding)', () => {
    expect(acheiHref('2HE93T6N')).toBe('/achei?ref=feed&de=2HE93T6N');
    expect(acheiHref('A B&C=d?é')).toBe('/achei?ref=feed&de=A%20B%26C%3Dd%3F%C3%A9');
  });
  it('cadastro: o que ele já aceita (intent=found, prefill_title, prefill_category), com acentos e símbolos codificados e sem perder nada na volta', () => {
    expect(cadastroHref(null)).toBe('/auth/register?intent=found');                       // sem contexto: o link de sempre
    const titulo = 'Câmera Ñ & café #1 100% "novo" +/?';
    const href = cadastroHref({ titulo, categoria: 'electronics' });
    expect(href.startsWith('/auth/register?')).toBe(true);
    const q = new URLSearchParams(href.split('?')[1]);
    expect(q.get('intent')).toBe('found'); expect(q.get('prefill_title')).toBe(titulo); expect(q.get('prefill_category')).toBe('electronics');
    expect(href).not.toMatch(/[ "<>]/);                                                   // nada cru na URL
    expect(cadastroHref({ titulo: 'x'.repeat(500), categoria: 'pet' }).length).toBeLessThan(260);
  });
  it('nas duas visualizações o botão do card leva o código (Publicações «Informar que encontrei», Grade «Encontrei»)', () => {
    const item = { code: 'T0000009', title: 'Carteira marrom', status: 'lost', status_label: 'Perdido', category: 'wallet', category_label: 'Carteira', origin: 'usuario', location_label: 'Recife - PE', has_photo: false, photo_url: null, created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true };
    for (const vis of ['publicacoes', 'grade'] as const) {
      const h = renderToString(React.createElement(FeedClient, { initialItems: [item as never], initialNextCursor: null, initialHasMore: false, page: 1, regions: [], visInicial: vis })).replace(/<!-- -->/g, '');
      expect(h, vis).toContain('href="/achei?ref=feed&amp;de=T0000009"');
      expect(h, vis).not.toContain('href="/achei?ref=feed"');
    }
  });
  it('o botão do card usa o link novo; «Informar que encontrei» continua só em perdido de usuário', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    expect((c.match(/href=\{acheiHref\(item\.code\)\}/g) ?? []).length).toBe(2);   // Publicações e Grade
    expect(c).not.toContain('"/achei?ref=feed"');                                       // nenhum link sem o código do card
    expect(c).toContain("item.can_report_found && item.status === 'lost'");
    expect(c).toContain('feedEvents.informarEncontreiClique()');
  });
});

describe('contexto aceito e texto', () => {
  it('validarContexto aceita só o formato exato da API', () => {
    const bom = { contexto: { titulo: 'Carteira marrom', categoria: 'wallet', categoria_rotulo: 'x', situacao: 'lost' } };
    expect(validarContexto(bom)).toEqual({ titulo: 'Carteira marrom', categoria: 'wallet', categoria_rotulo: 'Carteira', situacao: 'lost' });
    for (const ruim of [null, {}, { contexto: null }, { contexto: { titulo: '', categoria: 'wallet', situacao: 'lost' } }, { contexto: { titulo: 'x', categoria: 'nada', situacao: 'lost' } },
      { contexto: { titulo: 'x', categoria: 'wallet', situacao: 'found' } }, { contexto: { titulo: 5, categoria: 'wallet', situacao: 'lost' } }, { contexto: { titulo: 'x'.repeat(301), categoria: 'wallet', situacao: 'lost' } }, 'texto', 7])
      expect(validarContexto(ruim), JSON.stringify(ruim)).toBeNull();
  });
  it('palavras para a busca: sem a máscara, sem «em nome de», sem palavra de situação, até 6 palavras', () => {
    expect(palavrasDoTitulo('Bicicleta vermelha perdido')).toBe('Bicicleta vermelha');
    expect(palavrasDoTitulo('Chave em nome de (nome omitido)')).toBe('Chave');
    expect(palavrasDoTitulo('Um dois três quatro cinco seis sete oito')).toBe('Um dois três quatro cinco seis');
    expect(palavrasDoTitulo('<b>Celular</b> "azul" & preto')).toBe('b Celular b azul preto');
    expect(palavrasDoTitulo('roubado')).toBe('');
  });
});

describe('a página /achei', () => {
  const c = read('src/app/achei/client.tsx');
  it('o contexto só é lido no navegador depois de carregar (o HTML do servidor não muda) e a busca continua a mesma', () => {
    expect(c).not.toContain('useSearchParams');
    expect(c).toContain('window.location.search'); expect(c).toContain('lerDeDaUrl(');
    expect(c).toContain('buscarContexto(de, ctl.signal)'); expect(read('src/lib/feed/contexto.ts')).toContain('/api/v1/feed/contexto?de=');
    expect(c).toContain("params.set('status', 'lost')"); expect(c).toContain('/api/v1/objects/public?');
  });
  it('aviso «Você está informando sobre: <título>» + categoria; nenhuma promessa nova', () => {
    expect(c).toContain('Você está informando sobre: ');
    const bloco = c.slice(c.indexOf('{contexto && ('), c.indexOf('{/* Título */}'));
    expect(bloco).not.toMatch(/avis|contato|SMS|chat|protegid|resposta|gratuit|grátis|dono/i);
    expect(c).toContain('acheiEvents.contextoExibido(c.categoria, c.situacao)');
  });
  it('evento achei_contexto_exibido sem título nem código', () => {
    const a = read('src/lib/feed/analytics.ts');
    expect(a).toContain("send('achei_contexto_exibido', { categoria, situacao })");
  });
  it('sem contexto os dois links de cadastro são idênticos aos de hoje', () => {
    expect((c.match(/cadastroHref\(contexto, codigoDe\)/g) ?? []).length).toBe(2);
    expect(cadastroHref(null)).toBe('/auth/register?intent=found');
  });
  it('a página do servidor (metadados, canonical) não foi tocada', () => {
    const p = read('src/app/achei/page.tsx');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/achei` }"); expect(p).not.toContain('de=');
  });
});

describe('rota /api/v1/feed/contexto — banco simulado', () => {
  const sqls: Array<{ sql: string; args: unknown[] }> = [];
  let linhas: Array<Record<string, unknown>> = []; let falhar = false;
  beforeEach(() => { sqls.length = 0; linhas = []; falhar = false; resetLimite?.(); });
  let GET: (r: NextRequest) => Promise<Response>; let resetLimite: () => void; let limitar: (ip: string, agora?: number) => boolean;
  const carregar = async () => {   // UMA instância dos módulos (o limite vive em memória, como no servidor)
    vi.resetModules();
    vi.doMock('@/lib/db', () => ({ query: async (sql: string, args: unknown[]) => { sqls.push({ sql, args }); if (falhar) throw new Error('db'); return { rows: linhas }; } }));
    GET = (await import('@/app/api/v1/feed/contexto/route')).GET;
    ({ resetLimite, limitar } = await import('@/lib/feed/limite'));
  };
  const pede = async (de: string | null, ip = '10.0.0.1') => {
    if (!GET) await carregar();
    const r = await GET(new NextRequest(`http://localhost/api/v1/feed/contexto${de === null ? '' : `?de=${encodeURIComponent(de)}`}`, { headers: { 'x-forwarded-for': ip } }));
    return { status: r.status, corpo: await r.text(), cab: Object.fromEntries([...r.headers.entries()].filter(([k]) => ['cache-control', 'content-type', 'x-content-type-options'].includes(k))) };
  };
  it('a consulta usa a regra de elegibilidade do Feed, só perdido e sem sinal público, e passa o código como parâmetro', async () => {
    await pede('USR00001');
    expect(sqls).toHaveLength(1);
    expect(sqls[0].sql).toContain(FEED_ELIGIBILITY_WHERE.replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' '));
    expect(sqls[0].sql.replace(/\s+/g, ' ')).toContain(FEED_ELIGIBILITY_WHERE.replace(/\s+/g, ' '));
    expect(sqls[0].sql).toContain("o.status = 'lost'"); expect(sqls[0].sql).toContain("o.source IS DISTINCT FROM 'public_signal'");
    expect(sqls[0].args).toEqual(['USR00001']); expect(sqls[0].sql).not.toContain('USR00001');
  });
  it('elegível: devolve só título (mascarado), categoria e situação — nada de id, dono, telefone, local ou descrição', async () => {
    linhas = [{ title: 'Chave em nome de Maria Souza Lima', category: 'keys', type: 'lost', user_id: 'x', description: 'segredo', location: 'rua' }];
    const r = await pede('USR00001');
    const j = JSON.parse(r.corpo);
    expect(r.status).toBe(200);
    expect(Object.keys(j)).toEqual(['contexto']); expect(Object.keys(j.contexto).sort()).toEqual(['categoria', 'categoria_rotulo', 'situacao', 'titulo']);
    expect(j.contexto.titulo).toContain('(nome omitido)'); expect(r.corpo).not.toMatch(/Maria|Souza|Lima|segredo|rua|user_id/);
    expect(j.contexto.categoria).toBe('keys'); expect(j.contexto.situacao).toBe('lost');
  });
  it('sem linha, código inválido, ausente ou erro do banco: resposta IDÊNTICA (corpo, status e cabeçalhos) e inválido nem consulta o banco', async () => {
    const nada = await pede('USR99999');                       // não existe / não elegível: o banco não devolve linha
    expect(nada.status).toBe(200); expect(nada.corpo).toBe('{"contexto":null}');
    falhar = true; const erro = await pede('USR00001'); falhar = false;
    const invalido = await pede('<script>'); const ausente = await pede(null); const longo = await pede('A'.repeat(200));
    for (const r of [erro, invalido, ausente, longo]) expect(r).toEqual(nada);
    expect(sqls.filter((s) => s.args[0] === '<script>' || s.args[0] === 'A'.repeat(200))).toHaveLength(0);
  });
  it('limite de pedidos: passado o teto, 429 sem corpo útil; outra origem não é afetada', async () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) expect((await pede('USR00001', '9.9.9.9')).status).toBe(200);
    const r = await pede('USR00001', '9.9.9.9'); expect(r.status).toBe(429); expect(r.corpo).toBe('{"contexto":null}');
    expect((await pede('USR00001', '8.8.8.8')).status).toBe(200);
    expect(limitar('1.1.1.1', 0)).toBe(false); for (let i = 0; i < LIMITE_POR_MINUTO; i++) limitar('1.1.1.1', 1000); expect(limitar('1.1.1.1', 61_000)).toBe(false);   // a janela reinicia
  });
  it('a API do Feed não foi alterada', () => {
    const f = read('src/app/api/v1/feed/route.ts');
    expect(f).not.toContain('contexto'); expect(f).not.toContain('de=');
  });
});

describe.skipIf(!TEST_DB)('rota /api/v1/feed/contexto — banco real', () => {
  let pool: Pool;
  let GET: (r: NextRequest) => Promise<Response>; let resetLimite: () => void;
  beforeAll(async () => {
    vi.resetModules(); vi.doUnmock('@/lib/db');
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    await pool.query(`INSERT INTO objects (title,status,category,qr_code,is_public,is_legacy,source,created_at,user_id)
      VALUES ('Chave em nome de Maria Souza Lima','lost','keys','USRMASK1',true,false,NULL,'2026-11-12',gen_random_uuid())`);
    GET = (await import('@/app/api/v1/feed/contexto/route')).GET;
    ({ resetLimite } = await import('@/lib/feed/limite'));
  });
  afterAll(async () => { await pool?.end(); });
  beforeEach(() => resetLimite());
  const pede = async (de: string) => { const r = await GET(new NextRequest(`http://localhost/api/v1/feed/contexto?de=${encodeURIComponent(de)}`, { headers: { 'x-forwarded-for': '7.7.7.7' } })); return { status: r.status, corpo: await r.text(), cab: r.headers.get('cache-control') }; };

  it('perdido de usuário público e não legado: devolve o contexto', async () => {
    const r = await pede('USR00001'); const j = JSON.parse(r.corpo);
    expect(j.contexto).toEqual({ titulo: 'Celular azul perdido', categoria: 'phone', categoria_rotulo: 'Celular', situacao: 'lost' });
  });
  it('título com nome de pessoa sai mascarado', async () => {
    const r = await pede('USRMASK1');
    expect(JSON.parse(r.corpo).contexto.titulo).toContain('(nome omitido)'); expect(r.corpo).not.toMatch(/Maria|Souza|Lima/);
  });
  it('enumeração: privado, legado, achado, roubado, devolvido, arquivado, protegido, sinal público (perdido e outros) e inexistente → EXATAMENTE a mesma resposta', async () => {
    const nada = await pede('NAOEXISTE1');
    expect(nada.corpo).toBe('{"contexto":null}'); expect(nada.status).toBe(200);
    const nao = ['PRV00001', 'LEG00001', 'LEG00002', 'LEG00003', 'USR00003', 'USR00008', 'USR00006', 'RET00001', 'ARC00001', 'PRO00001', 'SIG00004', 'SIG00010', 'SIG00001', 'SIG00011'];
    for (const c of nao) expect(await pede(c), c).toEqual(nada);
  });
  it('varredura: todos os códigos do banco de teste — só os perdidos de usuário elegíveis devolvem contexto', async () => {
    const { rows } = await pool.query(`SELECT qr_code, status, is_public, is_legacy, source FROM objects WHERE qr_code IS NOT NULL`);
    for (const o of rows) {
      const j = JSON.parse((await pede(o.qr_code)).corpo);
      const elegivel = o.status === 'lost' && o.is_public && !o.is_legacy && o.source !== 'public_signal';
      expect(j.contexto !== null, `${o.qr_code}`).toBe(elegivel);
      resetLimite();
    }
  });
});

describe('botão «Entrar em contato com o dono» leva o contexto ao cadastro', () => {
  const ctx = { titulo: 'Carteira marrom perdida', categoria: 'wallet' as const };
  it('com contexto válido o link leva intent=found, prefill_title, prefill_category e o código do card (de), tudo codificado', () => {
    const href = cadastroHref({ titulo: 'Câmera Ñ & café #1', categoria: 'electronics' }, '2HE93T6N');
    const q = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/auth/register?')).toBe(true);
    expect(q.get('intent')).toBe('found'); expect(q.get('prefill_title')).toBe('Câmera Ñ & café #1'); expect(q.get('prefill_category')).toBe('electronics'); expect(q.get('de')).toBe('2HE93T6N');
    expect(href).not.toMatch(/[ "<>]/);
  });
  it('sem contexto (nulo) o link é o de sempre, mesmo que haja um código; código inválido não vai junto', () => {
    expect(cadastroHref(null)).toBe('/auth/register?intent=found');
    expect(cadastroHref(null, '2HE93T6N')).toBe('/auth/register?intent=found');
    expect(new URLSearchParams(cadastroHref(ctx, '<script>').split('?')[1]).has('de')).toBe(false);
    expect(new URLSearchParams(cadastroHref(ctx, null).split('?')[1]).has('de')).toBe(false);
  });
  it('buscarContexto: contexto válido → objeto; ausente, inválido, não elegível, erro de rede ou resposta estranha → null', async () => {
    const orig = globalThis.fetch;
    const resp = (corpo: unknown, ok = true) => (async () => ({ ok, json: async () => corpo })) as unknown as typeof fetch;
    try {
      globalThis.fetch = resp({ contexto: { titulo: 'Carteira', categoria: 'wallet', categoria_rotulo: 'x', situacao: 'lost' } });
      expect(await buscarContexto('2HE93T6N')).toEqual({ titulo: 'Carteira', categoria: 'wallet', categoria_rotulo: 'Carteira', situacao: 'lost' });
      for (const ruim of [{ contexto: null }, {}, null, 'x', { contexto: { titulo: 'x', categoria: 'wallet', situacao: 'found' } }]) { globalThis.fetch = resp(ruim); expect(await buscarContexto('2HE93T6N'), JSON.stringify(ruim)).toBeNull(); }
      globalThis.fetch = resp({ contexto: null }, false); expect(await buscarContexto('2HE93T6N')).toBeNull();
      globalThis.fetch = (async () => { throw new Error('rede'); }) as unknown as typeof fetch; expect(await buscarContexto('2HE93T6N')).toBeNull();
    } finally { globalThis.fetch = orig; }
  });
  it('o /achei leva o código ao cadastro só com contexto válido e registra o clique com contexto (sem título nem código)', () => {
    const c = read('src/app/achei/client.tsx');
    expect(c).toContain('setContexto(c); setCodigoDe(de);');
    expect(c).toContain('onClick={aoIrParaCadastro}');
    expect(c).toContain('if (contexto) acheiEvents.cadastroClique(contexto.categoria, contexto.situacao)');
    expect(read('src/lib/feed/analytics.ts')).toContain("send('achei_contexto_cadastro_clique', { categoria, situacao })");
  });
  it('usuário já logado: o /achei não lê login nem muda o destino (continua o cadastro de hoje)', () => {
    const c = read('src/app/achei/client.tsx');
    expect(c).not.toMatch(/useAuth|Cookies|access_token|localStorage|sessionStorage/);
    expect(c).not.toContain('/dashboard/objects/new'); expect(c).not.toContain('/flow/found');
  });
});

describe('cadastro (/auth/register) com o contexto do card', () => {
  const r = read('src/app/auth/register/page.tsx');
  it('lê o código «de», pede o contexto à API e mostra «Você está informando sobre: <título>» + categoria; sem contexto não mostra nada', () => {
    expect(r).toContain("lerDe(searchParams.get('de'))"); expect(r).toContain('buscarContexto(deParam, ctl.signal)');
    expect(r).toContain('{ctxAchei && ('); expect(r).toContain('Você está informando sobre: '); expect(r).toContain('{ctxAchei.titulo}'); expect(r).toContain('{ctxAchei.categoria_rotulo}');
  });
  it('o título mostrado vem da API validada, NUNCA do texto da URL (prefill_title não é exibido)', () => {
    const jsx = r.slice(r.indexOf('return ('));
    expect(jsx).not.toMatch(/\{prefillTitle\}|\{prefillCategory\}/);
    expect(r).toContain("params.set('prefill_title',    prefillTitle)");   // o que segue ao cadastro do objeto continua como sempre
  });
  it('o aviso do cadastro não promete contato protegido, SMS, chat, aviso ao dono nem resposta', () => {
    const bloco = r.slice(r.indexOf('{ctxAchei && ('), r.indexOf('<h1 className="text-2xl font-bold text-white tracking-tight mb-1">Criar sua conta'));
    expect(bloco).not.toMatch(/avis|contato|SMS|chat|protegid|resposta|dono|gratuit|grátis/i);
  });
  it('o fluxo de cadastro e o destino depois dele não mudaram (intent, prefill e checkout)', () => {
    expect(r).toContain("router.push(`/dashboard/objects/new?${params.toString()}`)"); expect(r).toContain("params.set('prefill_category', prefillCategory)");
  });
});

describe('texto «É um desses?» sem promessa de chat protegido', () => {
  it('«A conversa acontece pelo chat da plataforma» não aparece mais em nenhum arquivo do /achei nem no HTML dele', () => {
    for (const f of ['src/app/achei/client.tsx', 'src/app/achei/page.tsx']) { expect(read(f)).not.toMatch(/chat da plataforma|conversa acontece/i); }
    const h = renderToString(React.createElement(AcheiClient));
    expect(h).not.toMatch(/chat da plataforma|conversa acontece/i);
    expect(read('src/app/achei/client.tsx')).toContain('Crie uma conta gratuita para registrar o que você encontrou e entrar em contato.');
  });
  it('o texto novo não promete contato protegido, SMS, chat, aviso ao dono nem resposta, e não fala de cobrança nem de limite', () => {
    const c = read('src/app/achei/client.tsx');
    const bloco = c.slice(c.indexOf('É um desses?'), c.indexOf('</Link>', c.indexOf('Entrar em contato com o dono')));
    expect(bloco).not.toMatch(/protegid|SMS|chat|avis|respond|resposta|pre[çc]o|cobran|limite|plano|\bat[ée] \d/i);
    expect(bloco).toContain('gratuita');
  });
  it('sem contexto, o HTML do servidor do /achei não traz aviso de contexto nem código', () => {
    const h = renderToString(React.createElement(AcheiClient));
    expect(h).not.toContain('Você está informando sobre'); expect(h).not.toContain('data-achei-contexto');
  });
});

describe('escolher outra ocorrência da lista («É este»)', () => {
  const base = { unique_code: 'USR00013', is_legacy: false, source: null, status: 'lost' };
  it('selecionável: só usuário, perdido, não legado, com código válido', () => {
    expect(codigoSelecionavel(base)).toBe('USR00013');
    expect(codigoSelecionavel({ ...base, source: 'web' })).toBe('USR00013');
    expect(codigoSelecionavel({ ...base, unique_code: '2HE93T6N' })).toBe('2HE93T6N');
  });
  it('não selecionável: legado, campo de legado ausente, sinal público, achado, roubado, sem código, código inválido ou com marcação', () => {
    for (const ruim of [{ ...base, is_legacy: true }, { ...base, is_legacy: undefined }, { ...base, is_legacy: null }, { ...base, source: 'public_signal' }, { ...base, status: 'found' }, { ...base, status: 'stolen' }, { ...base, status: undefined },
      { ...base, unique_code: undefined }, { ...base, unique_code: '' }, { ...base, unique_code: 'ab' }, { ...base, unique_code: '<script>alert(1)</script>' }, { ...base, unique_code: 'A'.repeat(200) }, { ...base, unique_code: 12345678 }])
      expect(codigoSelecionavel(ruim as never), JSON.stringify(ruim)).toBeNull();
  });
  const c = read('src/app/achei/client.tsx');
  it('o botão só existe com contexto do card (sem contexto o HTML é o de sempre) e usa a regra de elegibilidade', () => {
    expect(c).toContain('{codigoDe && (() => {'); expect(c).toContain('const cod = codigoSelecionavel(item);'); expect(c).toContain('if (!cod) return null;');
    const h = renderToString(React.createElement(AcheiClient));
    expect(h).not.toContain('data-achei-selecionar'); expect(h).not.toContain('É este'); expect(h).not.toContain('Selecionado');
  });
  it('o card de origem começa selecionado e o estado é indicado por texto («Selecionado») e por aria-pressed, não só por cor', () => {
    expect(c).toContain('const marcado = cod === codigoDe;'); expect(c).toContain('aria-pressed={marcado}'); expect(c).toContain('Selecionado'); expect(c).toContain("'É este'");
    expect(c).toContain('min-h-[44px]');
  });
  it('ao escolher, título e categoria vêm da rota de contexto validada — nunca da lista nem da URL — e o contexto muda junto com o código', () => {
    const sel = c.slice(c.indexOf('const selecionar = async'), c.indexOf('const aoIrParaCadastro'));
    expect(sel).toContain('buscarContexto(codigo)'); expect(sel).toContain('setContexto(c); setCodigoDe(codigo);');
    expect(sel).not.toMatch(/item\.|prefill|window\.location|title/);
    expect(sel).toContain('if (!c || id !== pedidoSelecao.current) return;');       // sem contexto ou escolha mais nova: fica a anterior
    expect(sel).toContain('cacheContexto.current.get(codigo)');                       // não repete pedido (limite de pedidos)
    expect(sel).toContain('acheiEvents.contextoAlterado(c.categoria, c.situacao)');
  });
  it('os dois botões de cadastro usam o card ESCOLHIDO', () => {
    expect((c.match(/cadastroHref\(contexto, codigoDe\)/g) ?? []).length).toBe(2);
    expect(c).not.toMatch(/cadastroHref\(contexto, [^c]/);   // nenhum usa um código fixo (como o do card de origem)
  });
  it('o texto do botão não promete contato protegido, SMS, chat, aviso ao dono nem resposta, e não fala de cobrança', () => {
    const bloco = c.slice(c.indexOf('«É este»: só com contexto'), c.indexOf('{/* Botão "Ver detalhes" */}'));
    expect(bloco).not.toMatch(/protegid|SMS|chat|avis|respond|resposta|pre[çc]o|cobran|limite|plano|dono/i);
  });
  it('evento achei_contexto_alterado só com categoria e situação', () => {
    expect(read('src/lib/feed/analytics.ts')).toContain("send('achei_contexto_alterado', { categoria, situacao })");
  });
  it('a rota de contexto, o limite e a elegibilidade não foram alterados por esta mudança', () => {
    const r = read('src/app/api/v1/feed/contexto/route.ts');
    expect(r).toContain("o.status = 'lost' AND o.source IS DISTINCT FROM 'public_signal'"); expect(r).toContain('limitar(ip)');
  });
});
