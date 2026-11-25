// Busca por texto dentro do Feed: perdidos, achados e roubados, sem cadastro; sem legado; sinônimos; busca ampla é só aviso (a lista vem); /buscar redireciona.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest@2 run --config tests/vitest.config.ts tests/feed-busca.test.ts
// ATENÇÃO: a parte de banco recria as tabelas do banco de teste (tests/fixtures/feed-schema.sql). Use banco descartável.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { removerTabelas } from './helpers/limpeza-banco';
import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NextRequest } from 'next/server';

(globalThis as unknown as { React: typeof React }).React = React;
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { BUSCA_MAX_CARACTERES, consultaDaUrl, normalizarConsulta } from '@/lib/feed/consulta';
import { SCORE_MIN_BUSCA, expandirKeyword } from '@/lib/buscaPublica';

/** Tabelas que este arquivo cria no banco de teste; removidas ao terminar (ver helpers/limpeza-banco.ts). */
const TABELAS_DO_TESTE = ['local_pages', 'municipalities', 'municipality_events', 'object_events', 'public_signal_evidence', 'users'];

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('texto da busca (sem banco)', () => {
  it('normaliza: espaços, controle e tamanho; só texto', () => {
    expect(normalizarConsulta('  óculos   de\tgrau \n')).toBe('óculos de grau');
    expect(normalizarConsulta('a'.repeat(500)).length).toBe(BUSCA_MAX_CARACTERES);
    expect(normalizarConsulta(null)).toBe(''); expect(normalizarConsulta(['x'])).toBe(''); expect(normalizarConsulta(42)).toBe('');
  });
  it('?q= da URL (vindo do /buscar antigo) é lido já normalizado; sem q ou vazio = nada', () => {
    expect(consultaDaUrl('?q=oculos%20de%20grau')).toBe('oculos de grau'); expect(consultaDaUrl('')).toBe(''); expect(consultaDaUrl('?x=1')).toBe('');
  });
  it('a lógica de sinônimos e o score mínimo são os da busca pública (mesmo módulo), sem motor novo', () => {
    // ACHADO: no comportamento antigo a chave «oculos» do dicionário nunca casava (normalizarPalavra tira o «s»: «oculo»); só o Feed liga a correção
    expect(expandirKeyword('oculos')).toEqual(['oculos', 'oculo']);
    expect(expandirKeyword('oculos', { radical: true })).toEqual(expect.arrayContaining(['lentes', 'grau', 'armacao']));
    expect(expandirKeyword('onibus', { radical: true })).toEqual(expect.arrayContaining(['coletivo', 'transporte']));
    expect(expandirKeyword('celular')).toEqual(expandirKeyword('celular', { radical: true })); // o resto do dicionário não muda
    expect(SCORE_MIN_BUSCA).toBe(20);
    expect(read('src/app/api/v1/objects/public/route.ts')).toContain("from '@/lib/buscaPublica'");
    expect(read('src/lib/feed/busca.ts')).toContain("from '@/lib/buscaPublica'");
    expect(read('src/lib/feed/busca.ts')).toContain('isBuscaAmpla');
  });
});

describe.skipIf(!TEST_DB)('busca do Feed com banco real', () => {
  let pool: Pool;
  let busca: typeof import('@/lib/feed/busca');
  let q: typeof import('@/lib/feed/query');
  let GET: (r: NextRequest) => Promise<Response>;

  const reset = async () => {
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    await pool.query(`
      INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,images,created_at,updated_at,user_id) VALUES
       ('Óculos de grau preto','Armação preta, esqueci no ônibus','lost','other','OCU00001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:00','2026-11-12 10:00',gen_random_uuid()),
       ('Lentes de grau com estojo','Estojo azul achado na pia','found','other','OCU00002',true,false,NULL,'Centro, Cascavel, PR','["https://pub-test.r2.dev/oc.jpg"]','2026-11-12 11:00','2026-11-12 11:00',gen_random_uuid()),
       ('Óculos de sol roubados','Roubaram na praia','stolen','other','OCU00003',true,false,NULL,'Boa Viagem, Recife, PE','[]','2026-11-12 12:00','2026-11-12 12:00',gen_random_uuid()),
       ('Óculos de grau do legado','Registro antigo de óculos de grau','lost','other','OCU00004',true,true,NULL,'Rua Antiga 1, São Paulo, SP','[]','2024-01-01','2024-01-01',NULL),
       ('Óculos de grau privado','Não público','lost','other','OCU00005',false,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 09:00','2026-11-12 09:00',gen_random_uuid()),
       ('Óculos de grau devolvido','Já devolvido','returned','other','OCU00006',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 08:00','2026-11-12 08:00',gen_random_uuid()),
       ('Roubaram carro do meu pai do dia das mães as 21:30 da noite','Chevrolet spin cor cinza 2020','stolen','vehicle','VEI00001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 13:00','2026-11-12 13:00',gen_random_uuid()),
       ('Carro antigo do legado','Registro antigo de carro','stolen','vehicle','VEI00002',true,true,NULL,'Rua Antiga 1, São Paulo, SP','[]','2024-01-01','2024-01-01',NULL)`);
    q.resetFeedCache();
  };
  const codes = async (texto: string, filtros = {}) => (await busca.buscarNoFeed(texto, filtros)).items.map((i) => i.code);
  const api = async (qs: string) => { const r = await GET(new NextRequest(`http://localhost/api/v1/feed/busca${qs}`)); return { res: r, body: await r.json() }; };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    q = await import('@/lib/feed/query'); busca = await import('@/lib/feed/busca');
    ({ GET } = await import('@/app/api/v1/feed/busca/route'));
  });
  beforeEach(reset);
  afterAll(async () => { await removerTabelas(pool, TABELAS_DO_TESTE); await pool?.end(); });

  it('acha perdido, achado e roubado (os três tipos) numa só busca, sem login', async () => {
    const r = await busca.buscarNoFeed('oculos grau', {});
    const por = Object.fromEntries(r.items.map((i) => [i.code, i.status]));
    expect(por.OCU00001).toBe('lost'); expect(por.OCU00002).toBe('found'); expect(por.OCU00003).toBe('stolen');
  });
  it('NUNCA traz legado, não público nem devolvido (regra do Feed), mesmo quando o texto casa', async () => {
    const c = await codes('oculos de grau');
    expect(c).toContain('OCU00001');
    for (const proibido of ['OCU00004', 'OCU00005', 'OCU00006']) expect(c).not.toContain(proibido);
    expect((await codes('registro legado antigo')).filter((x) => x.startsWith('LEG'))).toEqual([]);
  });
  it('sinônimo: «oculos» também acha «lentes» e «grau» (o dicionário da busca pública)', async () => {
    const c = await codes('oculos grau');
    expect(c).toContain('OCU00001');           // título tem «óculos de grau»
    expect(c).toContain('OCU00002');           // «Lentes de grau com estojo»: «lentes» e «grau» são sinônimos de «óculos»
    expect(c).toContain('OCU00003');           // «Óculos de sol roubados»: «sol» também é sinônimo no dicionário
    expect(await codes('oculos estojo')).toContain('OCU00002'); // «óculos» sem acento acha «Lentes» (sinônimo) e o texto do estojo
  });
  it('relevância: do mais parecido para o menos parecido (pontuação não crescente, a mesma da busca pública)', async () => {
    const { calcularScoreBusca } = await import('@/lib/buscaPublica');
    const r = await busca.buscarNoFeed('lentes de grau com estojo', {});
    expect(r.items[0].code).toBe('OCU00002');
    const bruto = await pool.query(`SELECT qr_code AS code, title, description, color, category, type FROM objects`);
    const nota = new Map(bruto.rows.map((x: Record<string, unknown>) => [String(x.code), calcularScoreBusca('lentes de grau com estojo', x, { radical: true, semAcento: true })]));
    const notas = r.items.map((i) => nota.get(i.code) ?? 0);
    expect(notas).toEqual([...notas].sort((a, b) => b - a));
    expect(notas.every((n) => n >= SCORE_MIN_BUSCA)).toBe(true);
  });
  it('respeita os filtros do Feed: situação e categoria', async () => {
    expect(await codes('oculos grau', { status: 'found' })).toEqual(['OCU00002']);
    expect(await codes('oculos grau', { status: 'stolen' })).toEqual(['OCU00003']);
    expect(await codes('oculos grau', { category: 'phone' })).toEqual([]);
  });
  it('respeita a região do visitante (estado) e nunca preenche com outras regiões', async () => {
    const pe = await codes('oculos grau', { uf: 'PE' });
    expect(pe).toEqual(['OCU00003']);
  });
  it('busca de UMA palavra («oculos») lista o óculos de grau perdido, por sinônimo e sem acento; `ampla` é só o aviso, não bloqueia', async () => {
    const r = await busca.buscarNoFeed('oculos', {});
    expect(r.ampla).toBe(true);                       // menos de 2 palavras que identifiquem: pede o aviso na tela
    const c = r.items.map((i) => i.code);
    expect(c).toContain('OCU00001');                  // «Óculos de grau preto» (perdido), digitado sem acento
    expect(c).toContain('OCU00002');                  // «Lentes de grau com estojo» (achado), por sinônimo
    expect(c).toContain('OCU00003');                  // «Óculos de sol roubados» (roubado)
    for (const proibido of ['OCU00004', 'OCU00005', 'OCU00006']) expect(c).not.toContain(proibido); // legado, não público, devolvido: nunca
  });
  it('outras buscas amplas (só cor, só palavra vazia) também seguem listando o que casar; `ampla` só avisa', async () => {
    for (const t of ['azul', 'oculos preto']) { const r = await busca.buscarNoFeed(t, {}); expect(r.ampla, t).toBe(true); expect(Array.isArray(r.items), t).toBe(true); }
    expect((await busca.buscarNoFeed('azul', {})).items.map((i) => i.code)).toContain('OCU00002'); // «Estojo azul…»
    expect((await busca.buscarNoFeed('oculos grau', {})).ampla).toBe(false);                      // 2 palavras: sem aviso
  });
  it('busca ampla com lista vazia (filtros sem correspondência): items vazio e ampla=true (a tela mostra o convite «Perdi»/«Encontrei»)', async () => {
    const r = await busca.buscarNoFeed('oculos', { category: 'phone' }); expect(r.items).toEqual([]); expect(r.ampla).toBe(true);
  });
  it('texto abaixo do mínimo NÃO consulta nada (nem a lista do Feed nem o banco)', async () => {
    for (const t of ['', ' ', 'x', null, undefined]) { const r = await busca.buscarNoFeed(t, {}); expect(r, String(t)).toEqual({ items: [], ampla: false, truncated: false }); }
    const src = read('src/lib/feed/busca.ts');
    expect(src.indexOf('BUSCA_MIN_CARACTERES) return')).toBeGreaterThan(0);
    expect(src.indexOf('BUSCA_MIN_CARACTERES) return')).toBeLessThan(src.indexOf('getRankedFeed(filtros)'));
    expect(src).not.toMatch(/isBuscaAmpla\(q\)\) return/);  // a busca ampla nunca zera a lista
    expect(src).toContain('ampla');
  });
  it('mesmo com `ampla`, a resposta da rota continua só com os campos do card (sem legado, sem dado novo, sem eco do texto)', async () => {
    const { body } = await api('?q=oculos');
    expect(body.ampla).toBe(true); expect(body.items.length).toBeGreaterThan(0);
    const permitidos = ['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title'];
    for (const it of body.items) expect(Object.keys(it).sort()).toEqual(permitidos);
    const txt = JSON.stringify(body); for (const proibido of ['owner_id', 'user_id', 'latitude', 'longitude', 'description', '_score', 'is_legacy', 'OCU00004']) expect(txt).not.toContain(proibido);
  });
  it('CAUSA CONFIRMADA: «carro» dava só 10 pontos à ocorrência (1 palavra no título, sem sinônimo, sem cor, categoria «vehicle»), abaixo dos 20 mínimos', async () => {
    const { calcularScoreBusca } = await import('@/lib/buscaPublica');
    const linha = { title: 'Roubaram carro do meu pai do dia das mães as 21:30 da noite', description: 'Chevrolet spin cor cinza 2020', color: null, category: 'vehicle', type: null };
    const O = { radical: true, semAcento: true };
    expect(calcularScoreBusca('carro', linha, O)).toBe(10);
    expect(calcularScoreBusca('veiculo', linha, O)).toBe(0);           // sem sinônimo «carro↔veiculo» no dicionário
    expect(calcularScoreBusca('chevrolet', linha, O)).toBe(20);        // a descrição soma 20 sozinha
    expect(calcularScoreBusca('spin', linha, O)).toBe(20);
    expect(calcularScoreBusca('carro roubado', linha, O)).toBe(10);
    expect(SCORE_MIN_BUSCA).toBe(20);                                  // a nota mínima da busca pública NÃO mudou
  });
  it('«carro» acha o veículo roubado (palavra inteira no título); legado e devolvido nunca; só os campos do card', async () => {
    const r = await busca.buscarNoFeed('carro', {});
    const c = r.items.map((i) => i.code);
    expect(c).toContain('VEI00001'); expect(c).toContain('USR00005');   // «Chaves de carro» (seed) também tem a palavra inteira
    expect(c).not.toContain('VEI00002');                                // legado
    const it = r.items.find((i) => i.code === 'VEI00001')!;
    expect(it.status).toBe('stolen'); expect(it.category).toBe('vehicle');
    expect(Object.keys(it).sort()).toEqual(['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title']);
    expect((await api('?q=carro')).body.items.map((i: { code: string }) => i.code)).toContain('VEI00001');
  });
  it('«carro roubado», «chevrolet» e «spin» também acham (por palavra inteira ou descrição)', async () => {
    for (const t of ['carro roubado', 'chevrolet', 'spin', 'Carros']) expect(await codes(t), t).toContain('VEI00001');
  });
  it('palavra literal só vale como palavra INTEIRA (não pedaço de outra) e só se identifica o objeto (cor, palavra vazia e descrição genérica não)', async () => {
    expect(await codes('carr')).not.toContain('VEI00001');             // pedaço de palavra
    expect(await codes('grande')).toEqual([]);                         // descrição genérica sozinha não vira «palavra que identifica»
    expect(await codes('de da do')).toEqual([]);                       // só palavras vazias: nada
    expect(await codes('foguete espacial')).toEqual([]);               // sem relação com nada: sem resultado
    expect(await codes('submarino')).toEqual([]);
  });
  it('o resto não mudou: «oculos» ainda acha o óculos de grau e cada ocorrência aparece uma vez; ordem por nível, depois nota e palavras exatas', async () => {
    const c = await codes('oculos'); expect(c).toContain('OCU00001'); expect(new Set(c).size).toBe(c.length);
    expect(read('src/lib/feed/busca.ts')).toMatch(/\(nivel\.get\(a\.code\) \?\? 9\)/);   // nível (exata, termo novo/categoria, nota), depois nota e palavras exatas
  });
  it('a regra é SÓ do Feed: a busca pública, SCORE_MIN_BUSCA e o dicionário ficam como estavam', () => {
    const pub = read('src/app/api/v1/objects/public/route.ts'); expect(pub).toContain('.filter(item => item._score >= SCORE_MIN_BUSCA)'); expect(pub).toContain('const amplo = searchParams.get(\'amplo\') === \'1\' && !strict;');
    const lib = read('src/lib/buscaPublica.ts'); expect(lib).toContain('export const SCORE_MIN_BUSCA = 20;'); expect(lib).toMatch(/Dicionário AMPLIADO[\s\S]*CONGELADO/);   // o SINONIMOS antigo segue congelado (o ampliado é à parte)
    expect(lib).not.toMatch(/^\s+(carro|veiculo|moto|bicicleta|pet): \[/m); // dicionário global NÃO alterado
  });
  it('sem resultado: lista vazia e ampla=false (a tela mostra o convite «Perdi»/«Encontrei»)', async () => {
    const r = await busca.buscarNoFeed('foguete espacial', {}); expect(r.items).toEqual([]); expect(r.ampla).toBe(false);
  });
  it('a resposta só leva a lista FIXA de campos do card: nada de dono, contato, coordenadas, descrição, score nem o texto digitado', async () => {
    const { res, body } = await api('?q=oculos%20de%20grau%20preto');
    expect(res.status).toBe(200);
    const permitidos = ['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title'];
    expect(body.items.length).toBeGreaterThan(0);
    for (const it of body.items) expect(Object.keys(it).sort()).toEqual(permitidos);
    expect(Object.keys(body).sort()).toEqual(['ampla', 'items', 'meta']);
    const txt = JSON.stringify(body); for (const proibido of ['owner_id', 'user_id', 'latitude', 'longitude', 'description', '_score', 'is_legacy', 'oculos de grau preto']) expect(txt).not.toContain(proibido);
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
  });
  it('nome de pessoa em sinal público sai mascarado (mesmas máscaras do Feed)', async () => {
    await pool.query(`INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,images,created_at,updated_at) VALUES
      ('Documento encontrado em nome de Maria Souza Lima','RG encontrado','found','document','SIG00099',true,false,'public_signal','Centro, Cascavel, PR','[]','2026-11-12','2026-11-12')`);
    q.resetFeedCache();
    const r = await busca.buscarNoFeed('documento rg cnh', {});
    const sig = r.items.find((i) => i.code === 'SIG00099');
    expect(sig).toBeTruthy(); expect(sig!.title).not.toMatch(/Maria|Souza|Lima/);
  });
  it('sem texto (ou texto de 1 letra) a ordem do Feed NÃO muda: a rota do Feed continua devolvendo a mesma lista', async () => {
    const { GET: GETFEED } = await import('@/app/api/v1/feed/route');
    const r = await GETFEED(new NextRequest('http://localhost/api/v1/feed')); const j = await r.json();
    const direto = (await q.getRankedFeed({})).items.slice(0, 12).map((i) => i.code);
    expect(j.items.map((i: { code: string }) => i.code)).toEqual(direto);
  });
  it('rota: erro de banco devolve 500 sem eco do texto e sem 401', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await pool.query('DROP TABLE objects CASCADE');
    q.resetFeedCache();
    const { res, body } = await api('?q=segredo%20de%20busca%20unico');
    expect(res.status).toBe(500); expect(JSON.stringify(body)).not.toContain('segredo');
    expect(spy.mock.calls.flat().join(' ')).not.toContain('segredo');
    spy.mockRestore();
  });
});

describe('/buscar redireciona para o Feed e o HTML do Feed não muda', () => {
  it('/buscar é um redirecionamento PERMANENTE que preserva ?q= (e ?keyword= de e-mails antigos), sem repassar o resto', async () => {
    const mod = await import('@/app/buscar/page');
    const destino = (sp: Record<string, string | string[] | undefined>) => {
      try { mod.default({ searchParams: sp }); return null; } catch (e) { return e as { digest?: string }; }
    };
    const d1 = destino({ q: 'oculos' }); expect(d1?.digest).toMatch(/NEXT_REDIRECT;(replace|push);\/feed\?q=oculos;308/);
    const d2 = destino({ keyword: 'oculos de grau' }); expect(d2?.digest).toContain('/feed?q=oculos%20de%20grau;308');
    const d3 = destino({}); expect(d3?.digest).toMatch(/;\/feed;308/);
    const d4 = destino({ q: ['a b', 'c'], status: 'found' }); expect(d4?.digest).toContain('/feed?q=a%20b;308');
  });
  it('o antigo cliente do /buscar saiu; o layout com a máscara do Clarity continua', () => {
    expect(() => read('src/app/buscar/client.tsx')).toThrow();
    expect(read('src/app/buscar/layout.tsx')).toContain('ClarityMask');
  });
  it('sitemap sem /buscar (e com /feed); JSON-LD de busca aponta para o Feed; robots segue deixando o crawler ver o redirecionamento', () => {
    const sm = read('src/app/sitemap.ts'); expect(sm).not.toContain('/buscar'); expect(sm).toContain('/feed');
    expect(read('src/app/layout.tsx')).toContain("urlTemplate: 'https://backfindr.com/feed?q={search_term_string}'");
    expect(read('src/app/robots.ts')).toContain("'/buscar'");
  });
  it('/feed?q= não é indexável (cabeçalho X-Robots-Tag) e a página continua estática (sem searchParams)', () => {
    const cfg = read('next.config.js'); expect(cfg).toMatch(/source: '\/feed', has: \[\{ type: 'query', key: 'q' \}\], headers: \[\{ key: 'X-Robots-Tag', value: 'noindex, follow' \}\]/);
    const page = read('src/app/feed/[[...slug]]/page.tsx'); expect(page).toContain('export const revalidate = 300'); expect(page).not.toMatch(/searchParams/);
    expect(page).toContain("alternates: { canonical: `${APP_URL}/feed` }");
  });
  it('HTML do servidor do Feed igual com e sem busca: o campo só existe no cliente depois de tocar em «Buscar»', async () => {
    const FeedClient = (await import('@/app/feed/FeedClient')).default;
    const html = (props = {}) => renderToString(React.createElement(FeedClient, { initialItems: [], initialNextCursor: null, initialHasMore: false, page: 1, regions: [], ...props }));
    const a = html(), b = html();
    expect(a).toBe(b);
    expect(a).not.toContain('data-feed-busca'); expect(a).not.toContain('role="search"'); expect(a).not.toContain('data-feed-resultados');
    expect(a).toContain('href="/feed#busca"'); // links do Feed que abrem a busca (sem texto novo)
  });
  it('o texto digitado nunca vai para a URL nem para analítica; sem evento novo', async () => {
    const c = read('src/app/feed/FeedClient.tsx'); const b = read('src/app/feed/FeedBusca.tsx');
    expect(c + b).not.toMatch(/feedEvents\.\w*busca|analytics\.|posthog|gtag|fbq|history\.(push|replace)State/i);
    expect(c).toMatch(/fetch\(`\/api\/v1\/feed\/busca\?\$\{qs\.toString\(\)\}`/);
    const { feedEvents } = await import('@/lib/feed/analytics'); expect(Object.keys(feedEvents).filter((k) => /busca/i.test(k))).toEqual([]);
  });
  it('campo: rótulo acessível, 44 px, foco visível; fechar com X ou Esc; link «Buscar» do topo abre o campo', () => {
    const b = read('src/app/feed/FeedBusca.tsx');
    expect(b).toContain('aria-label="Buscar ocorrências"'); expect(b).toContain('aria-label="Fechar busca"'); expect(b).toContain("e.key === 'Escape'");
    expect(b).toContain('min-h-[44px]'); expect(b).toContain('h-11 w-11'); expect(b).toContain('focus-within:ring-2');
    expect(b).toContain('abrirBuscaDoFeed()');
    expect(read('src/app/feed/[[...slug]]/page.tsx')).toContain('<BuscarLinkTopo />');
  });
  it('cada resultado é um card do Feed (mesmo FeedCard: /objeto/CÓDIGO, mesma marca de origem do «Voltar»); sem resultado mostra o convite que já existe', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    expect(c).toContain('achados.items.map((it, i) => <FeedCard key={it.code} item={it} index={i} vis={vis} />)');
    expect(c).toMatch(/data-feed-busca-vazio>[\s\S]*<ConviteFim pagina=\{page\} \/>/);
    // busca ampla: aviso curto ACIMA da lista (não bloqueia, não esconde); lista e aviso aparecem juntos
    expect(c).toContain('Para resultados mais precisos, acrescente cor, marca ou local.');
    expect(c).not.toContain('Sua busca precisa de mais detalhes');
    expect(c.indexOf('data-feed-busca-ampla')).toBeLessThan(c.indexOf('achados.items.map((it, i) => <FeedCard'));
    expect(c).toMatch(/\{achados\.ampla && \(\s*<p data-feed-busca-ampla/);
    expect(c).not.toMatch(/achados\.ampla \? \(/);
    expect(read('src/lib/voltarFeed.ts')).toContain("/^\\/feed(\\/|$)/");
  });
  it('lista sem texto intacta: carregamento híbrido, ordem por faixas, FeedFoto e Voltar não foram tocados', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    expect(c).toContain('export const LOTES_AUTOMATICOS = 3;'); expect(c).toContain('<FeedFoto '); expect(c).toContain('podeCarregarAutomatico(autoLoads)');
    expect(c).toContain('Ver mais ocorrências'); expect(c).toMatch(/!modoBusca|modoBusca \?/);
    for (const f of ['src/lib/feed/order.ts', 'src/lib/feed/query.ts', 'src/components/VoltarAoFeed.tsx']) expect(read(f), f).not.toMatch(/busca/i);
  });
});
