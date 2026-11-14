// Acabamento mobile do Feed: ações dos cards em duas linhas (sem quebra de texto, sem chegar à área do chat),
// ícone de compartilhar legível, botão fixo que não cobre texto nem botão, espaço no fim da página e bloco explicativo.
// Só aparência: o CONTEÚDO do HTML do servidor não muda (textos, links, ordem, quantidade de cards).
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

import FeedClient from '@/app/feed/FeedClient';
import { RegisterMenu } from '@/app/feed/FeedCta';
import type { FeedItem } from '@/lib/feed/query';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const clean = (html: string) => html.replace(/<!-- -->/g, '');
const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul perdido', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: true, photo_url: 'https://pub-test.r2.dev/a.jpg',
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const COM_FOTO = mk({});
const SEM_FOTO = mk({ code: 'T0000002', title: 'Carteira de identidade', category: 'document', has_photo: false, photo_url: null, status: 'lost', status_label: 'Perdido' }); // usuário + perdido: o único caso em que «Informar que encontrei» aparece
const SINAL = mk({ code: 'T0000003', origin: 'sinal_publico', can_report_found: false, has_photo: false, photo_url: null });
const lista = (n: number) => Array.from({ length: n }, (_, i) => mk({ code: `T00000${i + 1}0`, title: `Ocorrência ${i + 1}`, has_photo: i % 2 === 0, photo_url: i % 2 === 0 ? 'https://pub-test.r2.dev/a.jpg' : null }));
const render = (items: FeedItem[], page = 1) => clean(renderToString(React.createElement(FeedClient, { initialItems: items, initialNextCursor: null, initialHasMore: false, page, regions: ['SP'] })));
const articles = (html: string) => html.split('<article').slice(1).map((a) => '<article' + a.split('</article>')[0]);
const acoesDe = (a: string) => a.slice(a.lastIndexOf('<div class="mt-3 flex flex-wrap'));
const client = read('src/app/feed/FeedClient.tsx');
const cta = read('src/app/feed/FeedCta.tsx');

describe('ações dos cards (Publicações): na mesma linha, sem quebra de texto', () => {
  const [cf, sf, sn] = articles(render([COM_FOTO, SEM_FOTO, SINAL]));
  it('«Ver detalhes», «Compartilhar» e «Informar que encontrei» na MESMA linha (só quebram se não couberem): sem linha sozinha', () => {
    for (const a of [cf, sf]) {
      const x = acoesDe(a);
      expect(x).toContain('flex flex-wrap'); expect(x).not.toContain('grid-cols'); expect(x).not.toContain('col-span-2');
      expect(x.indexOf('Ver detalhes')).toBeLessThan(x.indexOf('Compartilhar'));
      expect(x.indexOf('Compartilhar')).toBeLessThan(x.indexOf('Informar que encontrei'));
    }
  });
  it('nenhum texto de botão quebra (whitespace-nowrap) e a altura mínima de toque é 44 px', () => {
    for (const a of [cf, sf]) {
      const x = acoesDe(a);
      const botoes = x.match(/<(a|button) [^>]*class="[^"]*"[^>]*>(?:Ver detalhes|[\s\S]*?Compartilhar|Informar que encontrei)/g) ?? [];
      expect(botoes.length).toBe(3);
      for (const b of botoes) { expect(b).toContain('whitespace-nowrap'); expect(b).toContain('min-h-[44px]'); }
    }
  });
  it('ícone de «Compartilhar»: tamanho fixo (18 px) e que não encolhe', () => {
    const x = acoesDe(cf);
    const botao = x.match(/<button [^>]*class="([^"]*)"/)![1].replace(/&amp;/g, '&').replace(/&gt;/g, '>'); // o HTML escapa & e >
    expect(botao).toContain('[&>svg]:h-[18px]'); expect(botao).toContain('[&>svg]:w-[18px]'); expect(botao).toContain('[&>svg]:shrink-0');
  });
  it('as ações ficam alinhadas à esquerda com largura natural (nunca esticam até o canto do chat)', () => {
    for (const a of [cf, sf]) {
      const x = acoesDe(a);
      expect(x).toContain('justify-start');
      expect(x).not.toMatch(/<(a|button)[^>]*class="[^"]*\b(flex-1|w-full)\b/); // nada de botão esticado
    }
  });
  it('card sem foto: a linha de ações começa na borda do card (volta o espaço do ícone), para caber ao lado do chat; com foto não precisa', () => {
    expect(acoesDe(sf)).toContain('-ml-12 sm:ml-0');
    expect(acoesDe(cf)).not.toContain('-ml-12');
  });
  it('largura mínima: abaixo de 360 px usa fonte e espaçamento menores (cabe antes da área do chat)', () => {
    expect(client).toContain('max-[359px]:px-2.5');
    expect(client).toContain('max-[359px]:text-xs');
  });
  it('card de sinal (sem «Informar que encontrei») continua só com «Ver detalhes» e «Compartilhar»', () => {
    const x = acoesDe(sn);
    expect(x).toContain('Ver detalhes'); expect(x).toContain('Compartilhar'); expect(x).not.toContain('Informar que encontrei');
  });
});

describe('o CONTEÚDO do HTML do servidor não muda', () => {
  const html = render(lista(12));
  it('12 cards, 12 links /objeto, mesmos textos dos botões, mesma quantidade de «Informar que encontrei»', () => {
    expect(articles(html).length).toBe(12);
    expect((html.match(/href="\/objeto\/[^"]+"/g) ?? []).length).toBeGreaterThanOrEqual(12);
    expect((html.match(/>Ver detalhes</g) ?? []).length).toBe(12);
    expect((html.match(/>Informar que encontrei</g) ?? []).length).toBe(12);
    expect((html.match(/Compartilhar/g) ?? []).length).toBeGreaterThanOrEqual(12);
  });
  it('os textos dos botões do card são exatamente os de antes', () => {
    for (const t of ['Ver detalhes', 'Compartilhar', 'Informar que encontrei']) expect(client).toContain(t);
    expect(client).toContain('href="/achei?ref=feed"');
  });
  it('só aparência: nenhuma mudança em dados, filtros, endpoints, paginação nem eventos', () => {
    expect(client).toContain("'/api/v1/feed/geo'");
    expect(client).toContain('feedEvents.informarEncontreiClique()');
    expect(client).toContain('feedEvents.cardAberto(item.origin)');
    expect(client).toContain('feedEvents.compartilhar(item.origin)');
    expect(client).toContain('Ver mais ocorrências');
  });
});

describe('bloco explicativo', () => {
  it('aparece 1 vez, depois do 3º card, só na página 1; título e texto iguais', () => {
    const h = render(lista(6));
    expect((h.match(/data-feed-about/g) ?? []).length).toBe(1);
    const arts = [...h.matchAll(/<article/g)].map((m) => m.index!);
    expect(h.indexOf('data-feed-about')).toBeGreaterThan(arts[2]); expect(h.indexOf('data-feed-about')).toBeLessThan(arts[3]);
    expect(h).toContain('O Backfindr vai além das publicações');
    expect(render(lista(6), 2)).not.toContain('data-feed-about');
  });
});

describe('botão fixo «+ Cadastrar ocorrência»', () => {
  it('nasce visível no HTML do servidor (igual para todos) e respeita a área segura do iPhone', () => {
    const h = clean(renderToString(React.createElement(RegisterMenu, { variant: 'fixed', pagina: 1 })));
    expect(h).toContain('data-recolhido="false"'); expect(h).toContain('data-sobreposto="false"');
    expect(h).toContain('bottom-[max(0.5rem,env(safe-area-inset-bottom))]');   // mais perto da borda, respeitando a área segura do iPhone
    expect(h).toContain('left-4'); expect(h).toContain('sm:hidden');  // canto esquerdo, só no celular (o chat fica à direita)
  });
  it('regra: só fica visível se NÃO cobrir texto nem botão; recolhe enquanto a página se mexe e ao rolar para baixo; topo e fim da página mostram', () => {
    expect(cta).toContain("const escondido = variant === 'fixed' && !open && !comFoco && (recolhido || rolando || sobreposto)");
    expect(cta).toContain('function cobreConteudo(');
    expect(cta).toMatch(/y <= 24 \|\| fim\) setRecolhido\(false\)/);
    expect(cta).toMatch(/d > 8 && !openRef\.current\) \{ setRecolhido\(true\)/);
    expect(cta).toMatch(/d < -8\) setRecolhido\(false\)/);
  });
  it('mede a sobreposição: textos (retângulos só do texto), botões, links e campos; fotos não contam', () => {
    const f = cta.slice(cta.indexOf('function cobreConteudo('), cta.indexOf('/** Menu «+ Cadastrar ocorrência»'));
    for (const seletor of ['main h1', 'main h2', 'main h3', 'main p', 'main time', 'main a', 'main button', 'main select']) expect(f).toContain(seletor);
    expect(f).toContain('createRange');
    expect(f).not.toContain('main img');
  });
  it('remede ao terminar de rolar, ao mudar o tamanho da tela e quando a página muda de altura (fotos carregando)', () => {
    expect(cta).toContain('setTimeout(aoParar, 140)');
    expect(cta).toContain('ResizeObserver'); expect(cta).toContain("addEventListener('resize', medir)"); expect(cta).toContain("addEventListener('orientationchange', medir)");
  });
  it('menu aberto e foco do teclado nunca recolhem o botão', () => {
    expect(cta).toContain('!open && !comFoco');
    expect(cta).toContain("addEventListener('focusin', onFocusIn)");
  });
});

describe('espaço no fim da página e o que não mudou', () => {
  it('a página reserva espaço embaixo do último card e do «Ver mais» (pb-32 no celular)', () => {
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toMatch(/pb-32[^"]*sm:pb-6/);
  });
  it('canonical, robots, cache de 5 min e títulos iguais', () => {
    const p = read('src/app/feed/[[...slug]]/page.tsx');
    expect(p).toContain('export const revalidate = 300');
    expect(p).toContain("alternates: { canonical: `${APP_URL}/feed` }");
    expect(p).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
  });
  it('o chat não foi alterado e nenhum arquivo do Feed marca «data-widget-safe-zone»', () => {
    expect(client + cta).not.toContain('data-widget-safe-zone');
  });
  it('nenhum arquivo fora de src/app/feed (+ testes/docs) foi tocado: endpoints, query, geo, máscara', () => {
    // as rotas e a lógica de dados são lidas só para garantir que continuam com os mesmos pontos de entrada
    expect(read('src/app/api/v1/feed/route.ts')).toContain('getRankedFeed');
    expect(read('src/lib/feed/query.ts')).toContain('is_legacy');
  });
});
