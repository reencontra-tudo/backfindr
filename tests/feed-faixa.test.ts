// Faixa de situações no celular (Todos / Perdidos / Achados / Roubados): botões e espaço menores e degradê de rolagem. SÓ classes.
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
import FeedClient from '@/app/feed/FeedClient';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const client = read('src/app/feed/FeedClient.tsx');
const html = renderToString(React.createElement(FeedClient, { initialItems: [], initialNextCursor: null, initialHasMore: false, page: 1, regions: ['SP'] })).replace(/<!-- -->/g, '');
const faixaCls = () => html.match(/<div class="([^"]*)" role="group" aria-label="Situação">/)![1].replace(/&amp;/g, '&');
const botoes = [...html.matchAll(/<button type="button" aria-pressed="(true|false)" class="([^"]*)">([^<]*)<\/button>/g)];

describe('faixa de situações: só classes', () => {
  it('continuam 4 botões, na mesma ordem e com os mesmos textos; «Todos» começa selecionado', () => {
    expect(botoes.map((b) => b[3])).toEqual(['Todos', 'Perdidos', 'Achados', 'Roubados']);
    expect(botoes.map((b) => b[1])).toEqual(['true', 'false', 'false', 'false']);
  });
  it('botões: px-3 (antes px-4), altura mínima de toque de 44 px e sem encolher', () => {
    for (const b of botoes) { expect(b[2]).toContain('px-3'); expect(b[2]).not.toContain('px-4'); expect(b[2]).toContain('min-h-[44px]'); expect(b[2]).toContain('shrink-0'); }
  });
  it('faixa: espaço menor entre os botões (gap-1.5, antes gap-2), continua rolável na horizontal', () => {
    const c = faixaCls();
    expect(c).toContain('gap-1.5'); expect(c).not.toMatch(/\bgap-2\b/); expect(c).toContain('overflow-x-auto'); expect(c).toContain('flex');
  });
  it('degradê nas bordas, só com CSS: tampas do fundo (attachment local) por cima de sombras fixas', () => {
    const c = faixaCls();
    expect(c).toContain('[background-attachment:local,local,scroll,scroll]');
    expect((c.match(/linear-gradient/g) ?? []).length).toBe(4);
    expect((c.match(/#080b0f/g) ?? []).length).toBe(2);              // as DUAS tampas têm a cor do fundo da página (precisam ser iguais a ela)
    expect((c.match(/rgba\(8,11,15,0\)/g) ?? []).length).toBe(2);   // e terminam transparentes na mesma cor
    expect(c).toContain('bg-no-repeat');
  });
  it('a cor das tampas é a do fundo da página e do corpo', () => {
    expect(read('src/app/feed/[[...slug]]/page.tsx')).toContain('bg-[#080b0f]'); expect(read('src/app/globals.css')).toContain('body { background: #080b0f; }');
  });
  it('o resto do HTML da faixa é o de antes: grupo «Situação», aria-pressed, e filtros de categoria e região logo depois', () => {
    expect(html).toContain('role="group" aria-label="Situação"');
    expect(html.indexOf('aria-label="Situação"')).toBeLessThan(html.indexOf('Categoria'));
    expect(html).toContain('Todas as regiões'); expect(html).toContain('Todas as categorias');
  });
  it('lógica intacta: filtro de situação, eventos, ordem e carregamento híbrido', () => {
    expect(client).toContain("feedEvents.filtroAplicado('situacao', o.value); apply(o.value, category, region);");
    expect(client).toContain("{ value: 'stolen', label: 'Roubados' }");
    expect(client).toContain('export const LOTES_AUTOMATICOS = 3;');
    expect(client).toContain("const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;");   // restauração do #104
    expect(client).toContain("lerEstado(storage, { agora: Date.now(), pagina: page, regioes: regions })");
  });
});
