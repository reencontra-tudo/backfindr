// Feed v2: apresentação do serviço + acesso ao cadastro (topo, botão fixo/cabeçalho, bloco entre os cards).
// Parte 1 (sem banco): componentes, regras de texto, rotas e eventos. Parte 2 (Postgres real, só com TEST_DATABASE_URL): a página.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest@2 run --config tests/vitest.config.ts tests/feed-apresentacao.test.ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { CTA_ROUTES, IntroButtons, RegisterMenu } from '@/app/feed/FeedCta';
import FeedClient from '@/app/feed/FeedClient';
import type { FeedItem } from '@/lib/feed/query';

const root = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const clean = (html: string) => html.replace(/<!-- -->/g, '');
const html = (el: React.ReactElement) => clean(renderToString(el));
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const TEXTO_BASE_1 = 'Perdeu ou encontrou algo?';   // chamada curta do topo (substituiu «Perdeu algo? Encontrou alguma coisa?»)
const TEXTO_BASE_2 = 'O Backfindr conecta pessoas que perderam e encontraram objetos, documentos, animais e veículos. Cadastre uma ocorrência e descubra possíveis correspondências.';
const BLOCO_TITULO = 'O Backfindr vai além das publicações';
// Nada de promessa de preço, contato protegido, SMS ou canal de conversa (nada confirmado)
const PROIBIDO = /gratuit|gr[aá]tis|\bfree\b|R\$|pre[cç]o|SMS|contato (protegido|seguro)|protegid|mascar|\bchat\b|conversa|mensagem/i;

const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul perdido', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: false, photo_url: null, created_at: '2026-11-10T10:00:00.000Z',
  source_url: null, source_name: null, can_report_found: true, ...o,
});
const lista = (n: number) => Array.from({ length: n }, (_, i) => mk({ code: `T000000${i + 1}`, title: `Ocorrência ${i + 1}` }));
const client = (items: FeedItem[], page = 1) => html(React.createElement(FeedClient, { initialItems: items, initialNextCursor: null, initialHasMore: false, page, regions: ['SP'] }));

describe('rotas: só fluxos que já existem', () => {
  it('Perdi → /flow/lost, Encontrei → /flow/found, Roubaram → /flow/stolen (com ?ref=feed)', () => {
    expect(CTA_ROUTES).toEqual({ perdi: '/flow/lost?ref=feed', encontrei: '/flow/found?ref=feed', roubado: '/flow/stolen?ref=feed' });
    for (const r of Object.values(CTA_ROUTES)) {
      const dir = r.split('?')[0].replace('/flow/', 'src/app/flow/');
      expect(existsSync(path.join(root, dir, 'page.tsx')), `${r} existe`).toBe(true);
    }
  });
  it('as páginas /flow/* são noindex (o ?ref=feed não cria páginas duplicadas no Google)', () => {
    for (const f of ['lost', 'found', 'stolen']) expect(read(`src/app/flow/${f}/page.tsx`)).toMatch(/robots:\s*'noindex'/);
  });
  it('nenhum fluxo novo foi criado: nenhum arquivo novo em src/app/flow nem em src/app/api', () => {
    expect(['bike', 'found', 'keys', 'lost', 'pet', 'phone', 'protect', 'stolen', 'vehicle', 'wallet'].every((d) => existsSync(path.join(root, 'src/app/flow', d)))).toBe(true);
  });
});

describe('botões do topo', () => {
  const h = html(React.createElement(IntroButtons, { pagina: 1 }));
  it('«Perdi algo» e «Encontrei algo» são links reais para os fluxos existentes', () => {
    expect(h).toMatch(/<a [^>]*href="\/flow\/lost\?ref=feed"[^>]*>Perdi algo<\/a>/);
    expect(h).toMatch(/<a [^>]*href="\/flow\/found\?ref=feed"[^>]*>Encontrei algo<\/a>/);
  });
  it('área de toque ≥ 44 px e texto escuro sobre cor clara (contraste)', () => {
    expect((h.match(/min-h-\[44px\]/g) ?? []).length).toBe(2);
    expect(h).toContain('text-[#1a1203]'); expect(h).toContain('text-[#04110f]');
  });
});

describe('menu «+ Cadastrar ocorrência»', () => {
  const fixo = html(React.createElement(RegisterMenu, { variant: 'fixed', pagina: 1 }));
  const cab = html(React.createElement(RegisterMenu, { variant: 'header', pagina: 1 }));
  it('botão fixo: só no celular (sm:hidden), no canto inferior ESQUERDO, abaixo do chat (z-40), sem ocupar o lado direito', () => {
    const abre = fixo.match(/<div[^>]*data-feed-register="fixed"[^>]*>/)![0];
    expect(abre).toMatch(/\bfixed\b/); expect(abre).toContain('left-4'); expect(abre).toContain('sm:hidden'); expect(abre).toContain('z-40');
    expect(abre).not.toMatch(/\bright-/); // o chat existente fica em right-6 / z-50
    expect(abre).toContain('safe-area-inset-bottom');
  });
  it('no desktop o mesmo acesso vira botão do cabeçalho (não fixo): hidden sm:block, sem «fixed»', () => {
    const abre = cab.match(/<div[^>]*data-feed-register="header"[^>]*>/)![0];
    expect(abre).toContain('hidden'); expect(abre).toContain('sm:block'); expect(abre).not.toMatch(/\bfixed\b/);
  });
  it('rótulo claro, área de toque ≥ 44 px, estado do menu para leitores de tela', () => {
    for (const h of [fixo, cab]) {
      expect(h).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"[^>]*>/);
      expect(text(h)).toContain('+ Cadastrar ocorrência');
      expect((h.match(/min-h-\[44px\]/g) ?? []).length).toBe(4); // botão + 3 opções
    }
  });
  it('os três links existem no HTML mesmo com o menu fechado (rastreáveis), cada um para o fluxo certo', () => {
    for (const h of [fixo, cab]) {
      expect(h).toMatch(/<div id="[^"]+" hidden=""[^>]*role="group"/);
      expect(h).toMatch(/href="\/flow\/lost\?ref=feed"[^>]*>Perdi algo</);
      expect(h).toMatch(/href="\/flow\/found\?ref=feed"[^>]*>Encontrei algo</);
      expect(h).toMatch(/href="\/flow\/stolen\?ref=feed"[^>]*>Roubaram algo meu</);
    }
  });
});

describe('bloco explicativo entre os cards', () => {
  it('página 1: UM bloco, depois do 3º card, sem quebrar a sequência de cards', () => {
    const h = client(lista(6));
    expect((h.match(/<article/g) ?? []).length).toBe(6);
    expect((h.match(/data-feed-about/g) ?? []).length).toBe(1);
    const ia = h.indexOf('data-feed-about');
    const arts = [...h.matchAll(/<article/g)].map((m) => m.index!);
    expect(ia).toBeGreaterThan(arts[2]); expect(ia).toBeLessThan(arts[3]);
    expect(h).toContain(BLOCO_TITULO);
    expect(h).toMatch(/<h2[^>]*>O Backfindr vai além das publicações<\/h2>/);
  });
  it('página 2 e seguintes: sem bloco', () => {
    for (const p of [2, 3]) expect(client(lista(6), p)).not.toContain('data-feed-about');
  });
  it('menos de 3 cards: sem bloco solto', () => {
    expect(client(lista(2))).not.toContain('data-feed-about');
  });
  it('só diz que ajuda a encontrar possíveis correspondências; não mostra dados de correspondência; links existentes', () => {
    const t = text(client(lista(4)).split('data-feed-about')[1].split('</aside>')[0]);
    expect(t).toContain('possíveis correspondências');
    expect(t).toMatch(/localização e características/);
    expect(t).not.toMatch(PROIBIDO);
    const h = client(lista(4));
    expect(h).toContain('href="/buscar"'); expect(h).toContain('href="/map"');
  });
  it('«Ver mais» real continua funcionando', () => {
    const h = html(React.createElement(FeedClient, { initialItems: lista(4), initialNextCursor: 'x', initialHasMore: true, page: 1, regions: [] }));
    expect(h).toContain('href="/feed/pagina/2"');
  });
});

describe('botão fixo: some ao rolar para baixo e volta ao rolar para cima', () => {
  const cta = read('src/app/feed/FeedCta.tsx');
  const fixo = html(React.createElement(RegisterMenu, { variant: 'fixed', pagina: 1 }));
  const cab = html(React.createElement(RegisterMenu, { variant: 'header', pagina: 1 }));
  it('no HTML do servidor ele nasce VISÍVEL (igual para todos); só o fixo tem o estado de rolagem', () => {
    expect(fixo).toContain('data-recolhido="false"'); expect(fixo).toContain('translate-y-0'); expect(fixo).not.toContain('translate-y-[calc');
    expect(cab).not.toContain('data-recolhido');
  });
  it('a lógica: esconde ao descer, mostra ao subir, no topo e com foco; menu aberto nunca some', () => {
    expect(cta).toContain("window.addEventListener('scroll', onScroll, { passive: true })");
    expect(cta).toMatch(/y <= 24 \|\| fim\) setRecolhido\(false\)/);
    expect(cta).toMatch(/d > 8 && !openRef\.current\) \{ setRecolhido\(true\)/);
    expect(cta).toMatch(/d < -8\) setRecolhido\(false\)/);
    expect(cta).toContain("addEventListener('focusin'");
    expect(cta).toContain("const escondido = variant === 'fixed' && !open && !comFoco && (recolhido || rolando || sobreposto)");
  });
  it('só mexe na posição (transform): sem mudar aparência, textos, rotas nem eventos', () => {
    expect(cta).toContain('pointer-events-none translate-y-[calc(100%+2rem)]');
    expect(cta).toContain('motion-reduce:transition-none');
    expect(cta).toContain("'/flow/lost?ref=feed'");
  });
});

describe('regras de texto (nada de promessa não confirmada)', () => {
  it('apresentação, bloco, botões e menu: sem gratuito/preço, contato protegido, SMS, chat ou conversa', () => {
    const src = ['src/app/feed/FeedCta.tsx', 'src/app/feed/[[...slug]]/page.tsx'].map(read).join('\n');
    const visivel = text(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) + ' ' + text(client(lista(4)));
    for (const frase of [TEXTO_BASE_1, TEXTO_BASE_2]) expect(visivel).toContain(frase);
    for (const trecho of [TEXTO_BASE_1, TEXTO_BASE_2, 'Perdi algo', 'Encontrei algo', 'Perdi', 'Encontrei', 'Roubaram algo meu', '+ Cadastrar ocorrência', BLOCO_TITULO])
      expect(trecho).not.toMatch(PROIBIDO);
  });
});

describe('eventos novos (PostHog), sem dado pessoal', () => {
  const capture = vi.fn();
  beforeEach(() => {
    capture.mockClear();
    vi.doMock('posthog-js', () => ({ default: { __loaded: true, capture } }));
    vi.stubGlobal('window', { location: { search: '?ref=feed_teste', hostname: 'backfindr.com' } });
    vi.stubGlobal('document', { referrer: '' });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('posthog-js'); });

  it('feed_cta_perdi, feed_cta_encontrei, feed_cta_roubado e feed_cta_cadastrar, só com origem, posicao e pagina', async () => {
    vi.resetModules();
    const { feedEvents } = await import('@/lib/feed/analytics');
    feedEvents.ctaPerdi('topo', 1); feedEvents.ctaEncontrei('fixo', 1); feedEvents.ctaRoubado('cabecalho', 2); feedEvents.ctaCadastrar('fixo', 1);
    expect(capture.mock.calls.map((c) => c[0])).toEqual(['feed_cta_perdi', 'feed_cta_encontrei', 'feed_cta_roubado', 'feed_cta_cadastrar']);
    for (const [, props] of capture.mock.calls) {
      expect(Object.keys(props).sort()).toEqual(['origem', 'pagina', 'posicao']);
      expect(props.origem).toBe('feed_teste'); // origem da visita (mesma lógica do feed_aberto)
      expect(['topo', 'fixo', 'cabecalho']).toContain(props.posicao);
      expect(typeof props.pagina).toBe('number');
    }
  });
  it('os cliques estão ligados: topo, menu fixo e menu do cabeçalho', () => {
    const cta = read('src/app/feed/FeedCta.tsx');
    for (const ev of ['ctaPerdi', 'ctaEncontrei', 'ctaRoubado', 'ctaCadastrar']) expect(cta).toContain(`feedEvents.${ev}`);
    expect(cta).toContain("'topo'"); expect(cta).toContain("'fixo'"); expect(cta).toContain("'cabecalho'");
  });
});

describe('o que NÃO mudou', () => {
  it('página: canonical, robots, cache de 5 min, paginação e títulos iguais', () => {
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toContain('export const revalidate = 300');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/feed` }");
    expect(p).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
    expect(p).toContain("const TITLE = 'Feed de ocorrências de objetos perdidos e achados'");
    expect(p).toContain('getRankedFeed({})');
    expect(p.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/force-dynamic|no-store|headers\(\)|cookies\(\)/);
  });
  it('FeedClient: filtros, endpoints e textos dos botões dos cards inalterados', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    for (const t of ['Ver detalhes', 'Compartilhar', 'Informar que encontrei', 'Ver mais ocorrências', 'Todas as regiões', 'Perto de mim', 'Só a minha cidade']) expect(c).toContain(t);
    expect(c).toContain("'/api/v1/feed/geo'"); expect(c).toContain('/api/v1/feed${qs');
  });
});

describe.skipIf(!TEST_DB)('página /feed com banco real', () => {
  let pool: Pool;
  let FeedPage: (a: { params: { slug?: string[] } }) => Promise<React.ReactElement>;
  const page = async (slug?: string[]) => clean(renderToString(await FeedPage({ params: { slug } })));

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    FeedPage = (await import('@/app/feed/[[...slug]]/page')).default as never;
  });
  afterAll(async () => { await pool?.end(); });

  it('página 1: UM h1 («Feed de ocorrências»), chamada curta e os dois botões logo depois e ANTES dos filtros; o texto longo foi para o bloco depois do 3º card', async () => {
    const h = await page();
    expect((h.match(/<h1/g) ?? []).length).toBe(1);
    expect(h).toMatch(/<h1[^>]*>Feed de ocorrências<\/h1>/);
    expect(h).not.toContain('Ocorrências recentes</h1>');
    const i1 = h.indexOf('</h1>'), iT = h.indexOf(TEXTO_BASE_1), iB = h.indexOf('href="/flow/found?ref=feed"', iT), iF = h.indexOf('aria-label="Filtros do Feed"');
    expect(i1).toBeGreaterThan(-1); expect(iT).toBeGreaterThan(i1); expect(iB).toBeGreaterThan(iT); expect(iF).toBeGreaterThan(iB);
    // os dois botões compactos: rótulo curto, nome acessível de sempre, mesmos destinos
    const topo = h.slice(iT, iF);
    const [perdi, encontrei] = topo.match(/<a [^>]*>[^<]*<\/a>/g)!;
    expect(perdi).toContain('href="/flow/lost?ref=feed"'); expect(perdi).toContain('aria-label="Perdi algo"'); expect(perdi).toMatch(/>Perdi<\/a>$/);
    expect(encontrei).toContain('href="/flow/found?ref=feed"'); expect(encontrei).toContain('aria-label="Encontrei algo"'); expect(encontrei).toMatch(/>Encontrei<\/a>$/);
    // o texto explicativo longo saiu do topo e continua no HTML do servidor, dentro do bloco depois do 3º card
    expect(h.slice(0, iF)).not.toContain(TEXTO_BASE_2);
    const arts = [...h.matchAll(/<article/g)].map((m) => m.index!);
    expect(text(h)).toContain(TEXTO_BASE_2);
    expect(h.indexOf(TEXTO_BASE_2)).toBeGreaterThan(arts[2]); expect(h.indexOf(TEXTO_BASE_2)).toBeLessThan(arts[3]);
    expect(text(h)).toContain('Os registros mais recentes de objetos, documentos e pets perdidos, achados ou roubados.');
    expect(h).not.toContain('Perdeu algo? Encontrou alguma coisa?');
  });
  it('página 1: 12 cards, links /objeto/ com o título, «Ver mais» real, bloco depois do 3º card, 2 menus (fixo + cabeçalho)', async () => {
    const h = await page();
    expect((h.match(/<article/g) ?? []).length).toBe(12);
    expect(h).toMatch(/href="\/objeto\/USR0000\d"[^>]*>[^<]+<\/a>/);
    expect(h).toContain('href="/feed/pagina/2"');
    expect((h.match(/data-feed-about/g) ?? []).length).toBe(1);
    const arts = [...h.matchAll(/<article/g)].map((m) => m.index!);
    expect(h.indexOf('data-feed-about')).toBeGreaterThan(arts[2]); expect(h.indexOf('data-feed-about')).toBeLessThan(arts[3]);
    expect(h).toContain('data-feed-register="fixed"'); expect(h).toContain('data-feed-register="header"');
    expect(h).toContain('href="/map"'); // «Ver histórico no mapa» continua
  });
  it('página 2: sem apresentação nem bloco; um h1; o botão de cadastro continua disponível', async () => {
    const h = await page(['pagina', '2']);
    expect((h.match(/<h1/g) ?? []).length).toBe(1);
    expect(h).not.toContain(TEXTO_BASE_1); expect(h).not.toContain('data-feed-about');
    expect(h).toContain('data-feed-register="fixed"');
    expect((h.match(/<article/g) ?? []).length).toBe(8);
  });
  it('máscara de nome intacta e nenhum dado de quem cadastrou no HTML', async () => {
    for (const h of [await page(), await page(['pagina', '2'])]) {
      for (const n of ['Pablo', 'Sebastiani', 'Padovani', 'Mello pequeno', '45999990000', 'contato@exemplo', 'owner_id', 'user_id']) expect(h).not.toContain(n);
    }
    expect(await page(['pagina', '2'])).toContain('em nome de (nome omitido)');
  });
  it('o HTML é igual para qualquer visitante (a página não lê cabeçalhos, cookies nem localização)', async () => {
    const a = await page(), b = await page();
    expect(a).toBe(b);
  });
});
