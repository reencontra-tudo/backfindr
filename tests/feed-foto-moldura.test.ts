// Moldura da foto do card do Feed: foto inteira (sem corte) sobre um fundo feito da própria foto. Sem banco.
//   npx vitest@2 run --config tests/vitest.config.ts tests/feed-foto-moldura.test.ts
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

import FeedClient from '@/app/feed/FeedClient';
import { FeedFoto } from '@/app/feed/FeedFoto';
import type { FeedItem } from '@/lib/feed/query';

const URL_FOTO = 'https://pub-test.r2.dev/a.jpg';
const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul perdido', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: true, photo_url: URL_FOTO,
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const clean = (html: string) => html.replace(/<!-- -->/g, '');
const renderFeed = (items: FeedItem[], vis?: 'grade' | 'publicacoes') => clean(renderToString(React.createElement(FeedClient, {
  initialItems: items, initialNextCursor: null, initialHasMore: false, page: 1, regions: ['SP'], ...(vis ? { visInicial: vis } : {}) })));
const articles = (html: string) => html.split('<article').slice(1).map((a) => '<article' + a.split('</article>')[0]);
const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const attr = (tag: string, nome: string) => tag.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1];

describe('componente FeedFoto', () => {
  const html = renderToStaticMarkup(React.createElement(FeedFoto, { src: URL_FOTO, alt: 'Foto: Celular', eager: false }));
  const [fundo, foto] = imgs(html);
  it('duas imagens: o fundo decorativo e a foto', () => {
    expect(imgs(html).length).toBe(2);
    expect(fundo).toContain('data-feed-foto="fundo"');
    expect(foto).toContain('data-feed-foto="foto"');
  });
  it('a foto aparece INTEIRA: object-contain, nunca object-cover', () => {
    expect(attr(foto, 'class')).toMatch(/\bobject-contain\b/);
    expect(attr(foto, 'class')).not.toMatch(/object-cover/);
  });
  it('o fundo é a mesma foto, ampliada, desfocada e escurecida (só CSS) e decorativa (alt vazio e aria-hidden)', () => {
    expect(attr(fundo, 'src')).toBe(URL_FOTO);
    expect(attr(foto, 'src')).toBe(URL_FOTO);                      // MESMA URL: uma só requisição de rede
    expect(fundo).toMatch(/alt=""/);
    expect(fundo).toContain('aria-hidden="true"');
    expect(attr(fundo, 'class')).toMatch(/\bblur-2xl\b/);
    expect(attr(fundo, 'class')).toMatch(/brightness-\[0\.7\]/);
    expect(attr(fundo, 'class')).toMatch(/\bscale-125\b/);
    expect(attr(fundo, 'class')).toMatch(/pointer-events-none/);
  });
  it('sem segunda URL, srcset nem imagem de fundo em CSS (que carregaria mesmo fora da tela)', () => {
    expect(html).not.toMatch(/srcset|background-image|url\(/);
  });
  it('texto alternativo da foto preservado', () => {
    expect(attr(foto, 'alt')).toBe('Foto: Celular');
  });
  it('lazy por padrão e eager nas primeiras, igual nas duas imagens (o fundo não força carregar o que está fora da tela)', () => {
    expect(attr(fundo, 'loading')).toBe('lazy'); expect(attr(foto, 'loading')).toBe('lazy');
    const e = imgs(renderToStaticMarkup(React.createElement(FeedFoto, { src: URL_FOTO, alt: 'x', eager: true })));
    expect(attr(e[0], 'loading')).toBe('eager'); expect(attr(e[1], 'loading')).toBe('eager');
    expect(attr(foto, 'decoding')).toBe('async');
  });
  it('contorno fino por dentro, sem receber clique', () => {
    expect(html).toMatch(/ring-1 ring-inset ring-black\/10/);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*pointer-events-none|pointer-events-none[^>]*aria-hidden="true"/);
  });
});

describe('cards do Feed com a moldura', () => {
  const FOTOS = [mk({}), mk({ code: 'T0000002', title: 'Cartaz de cacatua', category: 'pet', category_label: 'Pet' }), mk({ code: 'T0000003', title: 'Saca-rolhas' }),
    mk({ code: 'T0000004' }), mk({ code: 'T0000005' }), mk({ code: 'T0000006' })];
  for (const vis of ['publicacoes', 'grade'] as const) {
    describe(`visão ${vis}`, () => {
      const cards = articles(renderFeed(FOTOS, vis));
      it('cada card com foto usa a moldura: fundo + foto inteira', () => {
        expect(cards.length).toBe(FOTOS.length);
        for (const c of cards) {
          const [fundo, foto] = imgs(c);
          expect(imgs(c).length).toBe(2);
          expect(attr(fundo, 'src')).toBe(attr(foto, 'src'));
          expect(attr(foto, 'class')).toMatch(/object-contain/);
          expect(c).toContain('data-photo="sim"');
        }
      });
      it('o quadro mantém a proporção fixa de sempre (sem pulo de layout)', () => {
        for (const c of cards) {
          if (vis === 'grade') expect(c).toMatch(/aspect-\[4\/3\][^"]*bg-\[color:var\(--f-hover\)\]/);
          else expect(c).toMatch(/relative mb-0\.5 aspect-\[4\/3\] w-full overflow-hidden rounded-xl[^"]*sm:aspect-\[16\/10\]/);
          expect(c).toMatch(/overflow-hidden/);
        }
      });
      it('as primeiras imagens carregam logo (eager) e as demais tardiamente (lazy), como antes', () => {
        const limite = vis === 'grade' ? 4 : 2;
        cards.forEach((c, i) => { for (const t of imgs(c)) expect(attr(t, 'loading'), `card ${i}`).toBe(i < limite ? 'eager' : 'lazy'); });
      });
      it('título e link do card seguem iguais: o link continua cobrindo o card e a foto não vira link', () => {
        for (const c of cards) {
          expect(c).toMatch(/href="\/objeto\/T000000\d"/);
          expect(c).not.toMatch(/<a[^>]*>\s*<img/);
        }
      });
    });
  }
  it('grade: selo da situação e botão de compartilhar continuam por cima da foto, com fundo próprio', () => {
    const c = articles(renderFeed([mk({})], 'grade'))[0];
    expect(c.indexOf('data-feed-foto="foto"')).toBeLessThan(c.indexOf('Perdido</span>'));        // o selo vem depois da foto no HTML: pinta por cima
    expect(c).toMatch(/absolute bottom-2 left-2[^"]*text-\[color:var\(--f-selo-t\)\][^"]*/);
    expect(c).toMatch(/bg-white\/90/);                                                            // botão de compartilhar com fundo claro
  });
  it('card SEM foto continua igual: sem imagem e sem moldura', () => {
    for (const vis of ['publicacoes', 'grade'] as const) {
      const c = articles(renderFeed([mk({ has_photo: false, photo_url: null })], vis))[0];
      expect(imgs(c).length).toBe(0);
      expect(c).toContain('data-photo="nao"');
      expect(c).not.toContain('data-feed-foto');
    }
  });
  it('só links https viram foto; foto que falha volta ao card sem foto (mesmo código de antes)', () => {
    const f = readFileSync(path.join(__dirname, '..', 'src/app/feed/FeedClient.tsx'), 'utf8');
    expect(f).toMatch(/onError=\{\(\) => setPhotoFailed\(true\)\}/);
    expect(f).toMatch(/el\.complete && el\.naturalWidth === 0/);
    expect((f.match(/<FeedFoto /g) ?? []).length).toBe(2);
    expect(f).not.toMatch(/object-cover/);                                                        // o recorte antigo saiu do card
  });
  it('nenhuma outra tela usa este componente (só o Feed)', () => {
    const { execSync } = require('child_process');
    const usos = execSync(`grep -rl "FeedFoto" src --include=*.tsx --include=*.ts || true`, { encoding: 'utf8' }).trim().split('\n').sort();
    expect(usos).toEqual(['src/app/feed/FeedClient.tsx', 'src/app/feed/FeedFoto.tsx']);
  });
  it('HTML do servidor: os primeiros cards continuam chegando prontos, com a foto e o link de sempre', () => {
    const html = renderFeed([mk({})]);
    expect(html).toContain(`src="${URL_FOTO}"`);
    expect(html).toContain('alt="Foto: Celular azul perdido"');
    expect(html).toContain('href="/objeto/T0000001"');
  });
});
