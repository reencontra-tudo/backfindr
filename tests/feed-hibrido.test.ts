// Feed: carregamento híbrido (3 lotes automáticos + botão «Ver mais»), bloco de convite no fim e «Informar que encontrei» só em PERDIDO de usuário.
// O comportamento com rolagem real (observador, cliques) é conferido no navegador (tools/feed-hibrido-check.mjs); aqui: regras puras, HTML do servidor e código.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

import FeedClient, { LOTES_AUTOMATICOS, podeCarregarAutomatico } from '@/app/feed/FeedClient';
import { ConviteFim } from '@/app/feed/FeedCta';
import type { FeedItem } from '@/lib/feed/query';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const client = read('src/app/feed/FeedClient.tsx');
const cta = read('src/app/feed/FeedCta.tsx');
const clean = (html: string) => html.replace(/<!-- -->/g, '');
const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: false, photo_url: null,
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const lista = (n: number) => Array.from({ length: n }, (_, i) => mk({ code: `T${String(i + 1).padStart(7, '0')}`, title: `Ocorrência ${i + 1}` }));
const render = (items: FeedItem[], o: { page?: number; hasMore?: boolean } = {}) => clean(renderToString(React.createElement(FeedClient, {
  initialItems: items, initialNextCursor: o.hasMore ? 'x' : null, initialHasMore: o.hasMore ?? false, page: o.page ?? 1, regions: ['SP'] })));
const articles = (h: string) => h.split('<article').slice(1).map((a) => '<article' + a.split('</article>')[0]);
const PROIBIDO = /seguran|protegid|SMS|gratuit|gr[aá]tis|contato|expor|exposto|\bchat\b/i;

describe('carregamento híbrido: 3 lotes automáticos e depois o botão', () => {
  it('LOTES_AUTOMATICOS = 3 (os 12 do HTML + 2 automáticos = 36 cards)', () => {
    expect(LOTES_AUTOMATICOS).toBe(3);
    expect(12 * LOTES_AUTOMATICOS).toBe(36);
  });
  it('o automático para no 3º lote: com 0 e 1 lote automático ainda pode; com 2 (= 36 cards) PARA', () => {
    expect(podeCarregarAutomatico(0)).toBe(true);   // 12 cards
    expect(podeCarregarAutomatico(1)).toBe(true);   // 24 cards
    expect(podeCarregarAutomatico(2)).toBe(false);  // 36 cards: para e o «Ver mais» assume
    expect(podeCarregarAutomatico(3)).toBe(false);
    expect(podeCarregarAutomatico(19)).toBe(false);
  });
  it('só o carregamento automático conta; o clique em «Ver mais» não; a lista recomeça ao trocar filtro', () => {
    expect(client).toContain("if (origem === 'auto') setAutoLoads((n) => n + 1);");
    expect(client).toContain("void loadMore('auto')");
    expect(client).toContain("void loadMore('manual')");
    expect(client).toContain('setAutoLoads(0)');
    expect(client).toMatch(/if \(!el \|\| !hasMore \|\| autoParou \|\| typeof IntersectionObserver === 'undefined'\) return;/);
  });
  it('em telas abaixo de 360 px a linha do «Ver mais» fica à esquerda (para não chegar à área do chat)', () => {
    expect(client).toContain('justify-center gap-3 max-[359px]:justify-start');
  });
  it('o clique continua interceptado e carregando 12 pelo mesmo caminho (loadMore → /api/v1/feed com cursor)', () => {
    expect(client).toContain("onClick={(e) => { e.preventDefault(); void loadMore('manual'); }}");
    expect(client).toContain('buildQuery(status, category, region, geo, nextCursor)');
  });
});

describe('«Ver mais» continua link real no HTML do servidor', () => {
  it('/feed (página 1): link para /feed/pagina/2 com o mesmo texto; sem «anteriores»', () => {
    const h = render(lista(12), { page: 1, hasMore: true });
    expect(h).toMatch(/<a [^>]*href="\/feed\/pagina\/2"[^>]*>Ver mais ocorrências<\/a>/);
    expect(h).not.toContain('Ver ocorrências anteriores');
  });
  it('/feed/pagina/N: link para a próxima e «Ver ocorrências anteriores»', () => {
    const h = render(lista(12), { page: 4, hasMore: true });
    expect(h).toMatch(/<a [^>]*href="\/feed\/pagina\/5"[^>]*>Ver mais ocorrências<\/a>/);
    expect(h).toMatch(/<a [^>]*href="\/feed\/pagina\/3"[^>]*>Ver ocorrências anteriores<\/a>/);
  });
  it('o HTML do servidor NÃO ganha o bloco de convite enquanto há mais cards (continua igual para todos)', () => {
    const h = render(lista(12), { hasMore: true });
    expect(h).not.toContain('data-feed-convite'); expect(h).not.toContain('Não encontrou o que procurava?');
    expect((articles(h).length)).toBe(12);
  });
});

describe('bloco «Não encontrou o que procurava?»', () => {
  const h = render(lista(5), { hasMore: false });   // sem mais cards: o convite aparece no fim da lista
  it('aparece no fim da lista (depois da paginação), 1 vez, com o título exato', () => {
    expect((h.match(/data-feed-convite/g) ?? []).length).toBe(1);
    expect(h).toMatch(/<h2[^>]*>Não encontrou o que procurava\?<\/h2>/);
    expect(h.indexOf('data-feed-convite')).toBeGreaterThan(h.indexOf('aria-label="Paginação do Feed"'));
    expect(h.indexOf('data-feed-convite')).toBeGreaterThan(h.lastIndexOf('<article'));
  });
  it('botões «Perdi algo» e «Encontrei algo» com as MESMAS rotas de hoje', () => {
    const bloco = h.slice(h.indexOf('data-feed-convite'));
    expect(bloco).toMatch(/href="\/flow\/lost\?ref=feed"[^>]*>Perdi algo</);
    expect(bloco).toMatch(/href="\/flow\/found\?ref=feed"[^>]*>Encontrei algo</);
  });
  it('sem promessa de contato, segurança, SMS nem «gratuito»', () => {
    const bloco = h.slice(h.indexOf('data-feed-convite')).split('</aside>')[0].replace(/<[^>]+>/g, ' ');
    expect(bloco).not.toMatch(PROIBIDO);
  });
  it('botões do convite: largura natural, à esquerda e empilhados abaixo de 360 px (nunca chegam à área do chat)', () => {
    const bloco = h.slice(h.indexOf('data-feed-convite'));
    expect(bloco).toContain('flex flex-col items-start gap-2 min-[360px]:flex-row');
    expect(bloco).not.toContain('grid-cols-2');
  });
  it('lista vazia: o convite NÃO aparece (o estado vazio já tem os seus botões)', () => {
    expect(render([], { hasMore: false })).not.toContain('data-feed-convite');
  });
  it('também abaixo do «Ver mais» depois que o automático para (regra do código)', () => {
    expect(client).toContain('{items.length > 0 && (autoParou || !hasMore) && <ConviteFim pagina={page} />}');
    expect(client.indexOf('<ConviteFim')).toBeGreaterThan(client.indexOf('Ver mais ocorrências'));
  });
  it('reaproveita os componentes e os eventos feed_cta_* (só a POSIÇÃO «fim»); nenhum evento novo', () => {
    const f = clean(renderToString(React.createElement(ConviteFim, { pagina: 1 })));
    expect(f).toContain('data-feed-convite');
    expect(cta).toContain('<IntroButtons pagina={pagina} posicao="fim" compacto />');
    expect(cta).toContain('feedEvents.ctaPerdi(posicao, pagina)'); expect(cta).toContain('feedEvents.ctaEncontrei(posicao, pagina)');
    const an = read('src/lib/feed/analytics.ts');
    expect(an).toContain("'topo' | 'fixo' | 'cabecalho' | 'fim'");
    const eventos = [...an.matchAll(/'(feed_[a-z_]+)'/g)].map((m) => m[1]);
    expect([...new Set(eventos)].sort()).toEqual(['feed_aberto', 'feed_card_aberto', 'feed_compartilhar', 'feed_cta_cadastrar', 'feed_cta_encontrei', 'feed_cta_perdi', 'feed_cta_roubado', 'feed_filtro_aplicado', 'feed_informar_encontrei_clique'].sort());
  });
});

describe('«Informar que encontrei» só em PERDIDO de usuário', () => {
  const casos: [string, Partial<FeedItem>, boolean][] = [
    ['usuário perdido', { status: 'lost', status_label: 'Perdido', origin: 'usuario', can_report_found: true }, true],
    // a API ainda marca can_report_found=true para roubado de usuário; a TELA é que não mostra mais
    ['usuário roubado (API diz true)', { status: 'stolen', status_label: 'Roubado', origin: 'usuario', can_report_found: true }, false],
    ['usuário achado', { status: 'found', status_label: 'Achado', origin: 'usuario', can_report_found: true }, false],
    ['sinal público perdido', { status: 'lost', origin: 'sinal_publico', can_report_found: false }, false],
    ['sinal público roubado', { status: 'stolen', status_label: 'Roubado', origin: 'sinal_publico', can_report_found: false }, false],
  ];
  for (const [nome, o, tem] of casos) {
    it(`${nome}: ${tem ? 'tem' : 'NÃO tem'} o botão; «Ver detalhes» e «Compartilhar» sempre`, () => {
      const [a] = articles(render([mk(o)]));
      expect(a.includes('>Informar que encontrei<')).toBe(tem);
      expect(a).toContain('>Ver detalhes<'); expect(a).toContain('Compartilhar');
    });
  }
  it('o botão leva ao mesmo destino de sempre (/achei?ref=feed) e a condição está no código (cliente: HTML do servidor e lista carregada)', () => {
    expect(client).toContain("{item.can_report_found && item.status === 'lost' && (");
    expect(client).toContain('href="/achei?ref=feed"');
    const lote = render([...lista(2), mk({ code: 'T9', status: 'stolen', status_label: 'Roubado' })]);
    expect((lote.match(/>Informar que encontrei</g) ?? []).length).toBe(2);   // só os 2 perdidos
  });
  it('a API e a elegibilidade NÃO mudaram (can_report_found segue como antes em query.ts)', () => {
    expect(read('src/lib/feed/query.ts')).toContain("can_report_found: origin === 'usuario' && (status === 'lost' || status === 'stolen'),");
  });
});

describe('o que não mudou', () => {
  it('«Ver mais», paginação, canonical e robots da página; textos dos demais botões', () => {
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toContain('export const revalidate = 300');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/feed` }");
    expect(p).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
    for (const t of ['Ver detalhes', 'Compartilhar', 'Perdi algo', 'Encontrei algo', 'Ver mais ocorrências']) expect(client + cta).toContain(t);
  });
  it('o chat, o botão fixo e o espaço reservado continuam como estavam', () => {
    expect(cta).toContain("const escondido = variant === 'fixed' && !open && !comFoco && (recolhido || rolando || sobreposto)");
    expect(read('src/app/feed/[[...slug]]/page.tsx')).toContain('px-4 py-6 pb-32 sm:pb-6');
    expect(client + cta).not.toContain('data-widget-safe-zone');
  });
});
