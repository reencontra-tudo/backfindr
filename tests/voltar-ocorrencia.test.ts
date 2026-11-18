// «Voltar» sempre visível na página da ocorrência e imagem ampliada que sempre fecha (app instalado no iPhone, sem botão do navegador). Sem banco.
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
vi.mock('@/lib/db', () => ({ query: vi.fn(async () => { throw new Error('banco fora'); }) }));

import PublicObjectClient from '@/app/objeto/[code]/client';
import { ORIGEM_FEED_CHAVE, limparOrigemFeed, marcarOrigemFeed, podeVoltarNoHistorico } from '@/lib/voltarFeed';
import type { RegisteredObject } from '@/types';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), _m: m }; };
const obj = (o: Record<string, unknown> = {}) => ({ id: 'obj-1', unique_code: 'ABC12345', title: 'Celular azul perdido', description: 'x', status: 'lost', category: 'phone', photos: [], location: null, source: null, is_legacy: false, ...o }) as unknown as RegisteredObject;

describe('página da ocorrência: botão Voltar', () => {
  const html = renderToString(React.createElement(PublicObjectClient, { obj: obj() }));
  it('há um link «Voltar» para /feed, com rótulo acessível, no topo (funciona sem JavaScript)', () => {
    expect(html).toMatch(/<a [^>]*href="\/feed"[^>]*data-voltar-feed|<a [^>]*data-voltar-feed[^>]*href="\/feed"/);
    expect(html).toContain('aria-label="Voltar ao Feed"');
    expect(html).toMatch(/>Voltar<\/span>/);
  });
  it('o topo fica fixo (sticky) e respeita a área segura do iPhone', () => {
    const nav = html.match(/<nav [^>]*data-objeto-topo[^>]*>/)![0];
    expect(nav).toMatch(/sticky top-0/); expect(nav).toContain('bf-topo-seguro');
    const css = read('src/app/globals.css');
    expect(css).toMatch(/\.bf-topo-seguro \{ padding-top: env\(safe-area-inset-top/);
    expect(css).toMatch(/display-mode: standalone\) \{ \.bf-topo-seguro/);
  });
  it('alvo de toque de 44 px', () => { expect(read('src/components/VoltarAoFeed.tsx')).toContain('min-h-[44px]'); });
  it('o logotipo e o selo de situação continuam no topo', () => {
    expect(html).toContain('href="/"'); expect(html).toContain('Backfindr');
  });
  it('o botão só volta no histórico quando veio do Feed; senão é o link comum', () => {
    const c = read('src/components/VoltarAoFeed.tsx');
    expect(c).not.toContain('useRouter'); // sem hook de rota: a página renderiza em testes e no servidor sem contexto do roteador
    expect(c).toMatch(/podeVoltarNoHistorico\(a, window\.history\.length\)\)\s*\{\s*e\.preventDefault\(\);\s*limparOrigemFeed\(a\);\s*window\.history\.back\(\)/);
  });
});

describe('marca «veio do Feed»', () => {
  it('só marca quando o clique é, no Feed (inclui /feed/pagina/N), num link de ocorrência', () => {
    for (const pag of ['/feed', '/feed/pagina/2']) { const a = mem(); marcarOrigemFeed(a, pag, '/objeto/ABC12345'); expect(a._m.get(ORIGEM_FEED_CHAVE)).toBe('1'); }
    for (const [pag, dest] of [['/feed', '/achei?ref=feed'], ['/feed', null], ['/dashboard', '/objeto/ABC12345'], ['/feedback', '/objeto/ABC12345'], ['/buscar', '/objeto/X']] as const) {
      const a = mem(); marcarOrigemFeed(a, pag, dest); expect(a._m.size, `${pag} → ${dest}`).toBe(0);
    }
  });
  it('volta no histórico só com a marca e com histórico; sem armazenamento, nunca (cai no link)', () => {
    const a = mem(); expect(podeVoltarNoHistorico(a, 3)).toBe(false);
    marcarOrigemFeed(a, '/feed', '/objeto/ABC12345');
    expect(podeVoltarNoHistorico(a, 3)).toBe(true); expect(podeVoltarNoHistorico(a, 1)).toBe(false);
    limparOrigemFeed(a); expect(podeVoltarNoHistorico(a, 3)).toBe(false);
    expect(podeVoltarNoHistorico(null, 3)).toBe(false);
    const quebrado = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(() => marcarOrigemFeed(quebrado, '/feed', '/objeto/A')).not.toThrow(); expect(podeVoltarNoHistorico(quebrado, 3)).toBe(false); expect(() => limparOrigemFeed(quebrado)).not.toThrow();
  });
  it('o rastreador do Feed grava a marca no clique e continua zerando o «voltar» antigo', () => {
    const s = read('src/lib/feed/estado.ts');
    expect(s).toContain('marcarOrigemFeed(window.sessionStorage, window.location.pathname, a.getAttribute(\'href\'))');
    expect(s).toMatch(/ultimoPopstate = 0;\s*try \{ marcarOrigemFeed/);
  });
});

describe('imagem ampliada (lightbox)', () => {
  const src = read('src/components/ImageLightbox.tsx');
  it('botão X visível (44 px), abaixo da barra de status, e toque fora fecha', () => {
    expect(src).toMatch(/bf-lightbox-fechar[^"]*w-11 h-11/); expect(src).toContain('aria-label="Fechar"');
    expect(src).toMatch(/onClick=\{onClose\}\s*\n\s*onTouchStart/); // fundo fecha
    expect(src).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/); // clique na foto não fecha
    expect(read('src/app/globals.css')).toMatch(/\.bf-lightbox-fechar \{ top: max\(1rem, calc\(env\(safe-area-inset-top/);
  });
  it('gesto/botão de voltar do aparelho fecha a imagem: entra uma entrada no histórico e a desfaz ao fechar', () => {
    // a lógica do histórico passou para src/lib/lightboxHistorico.ts (testada de verdade em tests/lightbox-historico.test.ts)
    const lib = read('src/lib/lightboxHistorico.ts');
    expect(src).toContain('abrirEntradaLightbox(');
    expect(lib).toMatch(/pushState\(\{ \.\.\.\(estadoDe\(w\) \?\? \{\}\), \[LIGHTBOX_CHAVE\]: id \}, ''\)/);
    expect(lib).toContain("addEventListener('popstate', aoPopstate)");
    expect(lib).toMatch(/if \(empilhou && !encerrado\)[\s\S]*history\.back\(\)/);
  });
  it('ESC e setas continuam; o contador também respeita a barra de status', () => {
    expect(src).toContain("e.key === 'Escape'"); expect(src).toContain("'ArrowLeft'"); expect(src).toMatch(/bf-lightbox-fechar absolute left-1\/2/);
  });
});
