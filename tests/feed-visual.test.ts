// Aparência dos cards do Feed e região padrão / ordem do filtro «Cidade ou região». Sem banco.
//   npx vitest@2 run --config tests/vitest.config.ts tests/feed-visual.test.ts
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

import FeedClient from '@/app/feed/FeedClient';
import type { FeedItem } from '@/lib/feed/query';

const UFS = ['DF', 'PA', 'PB', 'PE', 'PR', 'RJ', 'RS', 'SC', 'SP'];
const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul perdido', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Boa Viagem, Recife - PE', has_photo: true, photo_url: 'https://pub-test.r2.dev/a.jpg',
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const COM_FOTO = mk({});
const SEM_FOTO = mk({ code: 'T0000002', title: 'Carteira de identidade', category: 'document', has_photo: false, photo_url: null, status: 'lost', status_label: 'Perdido' }); // usuário + perdido: o único caso em que «Informar que encontrei» aparece
const SINAL = mk({ code: 'T0000003', origin: 'sinal_publico', can_report_found: false, has_photo: false, photo_url: null, source_url: 'https://g1.globo.com/x', source_name: 'g1.globo.com' });

// O React separa textos vizinhos com «<!-- -->» no HTML do servidor; o navegador junta de novo. Tira para comparar o texto.
const clean = (html: string) => html.replace(/<!-- -->/g, '');
const render = (items: FeedItem[], page = 1) => clean(renderToString(React.createElement(FeedClient, {
  initialItems: items, initialNextCursor: null, initialHasMore: false, page, regions: UFS })));
const articles = (html: string) => html.split('<article').slice(1).map((a) => '<article' + a.split('</article>')[0]);
const src = readFileSync(path.join(__dirname, '..', 'src/app/feed/FeedClient.tsx'), 'utf8');

describe('região padrão e ordem das opções', () => {
  const regionSelect = (html: string) => html.split('<select')[2].split('</select>')[0];
  const options = (sel: string) => [...sel.matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)].map((m) => ({ value: m[1], attrs: m[2], label: m[3] }));

  it('ordem: Todas as regiões, Perto de mim, Só a minha cidade, depois os estados', () => {
    const o = options(regionSelect(render([COM_FOTO])));
    expect(o.map((x) => x.label)).toEqual(['Todas as regiões', 'Perto de mim', 'Só a minha cidade', ...UFS.map((u) => `Estado: ${u}`)]);
    expect(o.map((x) => x.value)).toEqual(['todas', 'auto', 'cidade', ...UFS]);
  });
  it('«Todas as regiões» vem selecionada ao abrir, sempre (também sem localização e na página 2)', () => {
    for (const page of [1, 2]) {
      const o = options(regionSelect(render([COM_FOTO], page)));
      expect(o.filter((x) => /\bselected\b/.test(x.attrs)).map((x) => x.value), `página ${page}`).toEqual(['todas']);
    }
  });
  it('as três primeiras opções existem desde o início (a localização só é buscada depois da escolha)', () => {
    const labels = options(regionSelect(render([]))).map((x) => x.label);
    expect(labels.slice(0, 3)).toEqual(['Todas as regiões', 'Perto de mim', 'Só a minha cidade']);
  });
  it('o aviso de «não localizado» NÃO aparece ao abrir', () => {
    expect(render([COM_FOTO])).not.toContain('Não conseguimos identificar');
  });
  it('a localização NÃO é detectada ao carregar: só dentro da escolha «Perto de mim»/«Só a minha cidade»', () => {
    expect((src.match(/detectGeo\(/g) ?? []).length).toBe(2); // definição + UMA chamada
    const montagem = src.match(/useEffect\(\(\) => \{ feedEvents\.aberto[\s\S]*?\}, \[\]\);/)![0];
    expect(montagem).not.toContain('detectGeo');
    const escolha = src.slice(src.indexOf('const chooseRegion'), src.indexOf('const loadMore'));
    expect(escolha).toContain('detectGeo(ctl.signal)');
    expect(escolha).toContain("value !== 'auto' && value !== 'cidade'");
    expect(src).not.toMatch(/ipapi\.co/);
  });
  it('falha ao localizar volta para «Todas as regiões» e mostra o aviso já existente', () => {
    const escolha = src.slice(src.indexOf('const chooseRegion'), src.indexOf('const loadMore'));
    expect(escolha).toContain("setGeoNotice(true)");
    expect(escolha).toMatch(/apply\(status, category, 'todas', g\)|setRegion\('todas'\)/);
    expect(src).toContain('Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.');
  });
  it('a medição da escolha de região continua com o mesmo evento', () => {
    expect(src).toContain("feedEvents.filtroAplicado('regiao', value)");
  });
});

describe('card com foto (estilo publicação)', () => {
  const [a] = articles(render([COM_FOTO]));
  it('ordem: foto, título, situação e categoria, local e data, ações', () => {
    const idx = ['<img', '<h2', 'Perdido', 'Boa Viagem', 'Registrado', 'Ver detalhes'].map((t) => a.indexOf(t));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });
  it('foto em largura total com proporção fixa (sem pulo de layout) e sem bloco «Sem foto»', () => {
    expect(a).toMatch(/aspect-\[4\/3\][^"]*w-full|w-full[^"]*aspect-\[4\/3\]/);
    expect(a).toContain('object-cover');
    expect(a).toContain('data-photo="sim"');
    expect(a).not.toMatch(/Sem foto/i);
  });
  it('situação e categoria numa ÚNICA linha discreta (sem vários selos)', () => {
    const linha = a.match(/<p[^>]*>(?:(?!<\/p>)[\s\S])*Perdido(?:(?!<\/p>)[\s\S])*<\/p>/)![0];
    expect(linha).toContain('Celular');
    expect(a).not.toMatch(/rounded-full border/); // nada de selos em volta
  });
  it('local e data na MESMA linha', () => {
    const linha = a.match(/<p[^>]*>(?:(?!<\/p>)[\s\S])*Boa Viagem(?:(?!<\/p>)[\s\S])*<\/p>/)![0];
    expect(linha).toContain('Registrado');
    expect(linha).toContain('<time');
  });
  it('título maior (text-lg) e é link para a página do objeto com o título como texto', () => {
    expect(a).toMatch(/<h2[^>]*text-lg/);
    expect(a).toMatch(/<a [^>]*href="\/objeto\/T0000001"[^>]*>Celular azul perdido<\/a>/);
  });
  it('ações: «Ver detalhes» é a principal e as outras são discretas; textos iguais aos de antes; em duas linhas no celular', () => {
    const acoes = a.slice(a.lastIndexOf('<div class="mt-3 grid'));
    for (const t of ['Ver detalhes', 'Compartilhar', 'Informar que encontrei']) expect(acoes).toContain(t);
    expect(acoes).toMatch(/bg-\[color:var\(--f-prim\)\][^"]*"[^>]*>Ver detalhes|aria-label="Ver detalhes[^"]*" class="[^"]*bg-\[color:var\(--f-prim\)\]/);
    expect((acoes.match(/bg-\[color:var\(--f-prim\)\]/g) ?? []).length).toBe(1); // só a principal é «cheia»
    expect(acoes).toContain('href="/achei?ref=feed"');
    expect(acoes).toContain('grid-cols-[auto_auto]');              // 1ª linha: Ver detalhes + Compartilhar
    expect(acoes).toMatch(/<a [^>]*class="[^"]*col-span-2[^"]*"[^>]*>Informar que encontrei/); // 2ª linha: sozinha
    expect(a).not.toMatch(/flex-wrap gap-2 pt-1/); // sem a linha de botões antiga que quebrava
  });
  it('menos caixas: o card não tem borda nem fundo próprios (divisória fina entre publicações)', () => {
    const abre = a.slice(0, a.indexOf('>') + 1);
    expect(abre).not.toMatch(/border|bg-white|rounded-2xl/);
    expect(render([COM_FOTO, SEM_FOTO])).toContain('divide-y divide-[color:var(--f-linha)]');
  });
  it('as duas primeiras fotos carregam já e as demais sob demanda', () => {
    const fotos = articles(render([mk({ code: 'A1' }), mk({ code: 'A2' }), mk({ code: 'A3' })])).map((x) => x.match(/loading="(\w+)"/)![1]);
    expect(fotos).toEqual(['eager', 'eager', 'lazy']);
  });
});

describe('card sem foto (compacto)', () => {
  const [a] = articles(render([SEM_FOTO]));
  it('sem bloco grande, sem imagem e sem o texto «Sem foto»; só um ícone pequeno ao lado do título', () => {
    expect(a).toContain('data-photo="nao"');
    expect(a).not.toContain('<img');
    expect(a).not.toMatch(/Sem foto/i);
    expect(a).not.toMatch(/h-44|aspect-\[/);
    expect(a).toMatch(/h-9 w-9[^"]*"[^>]*aria-hidden/);                 // ícone pequeno (36 px)
    expect(a.indexOf('h-9 w-9')).toBeLessThan(a.indexOf('<h2'));         // ao lado (antes) do título
  });
  it('mesmos dados e mesmas ações do card com foto', () => {
    for (const t of ['Carteira de identidade', 'Perdido', 'Documento', 'Boa Viagem, Recife - PE', 'Registrado', 'Ver detalhes', 'Compartilhar', 'Informar que encontrei'])
      expect(a, t).toContain(t);
    expect(a).toContain('href="/objeto/T0000002"');
  });
  it('ocupa bem menos marcação de imagem: o card com foto reserva a altura da foto e o sem foto não', () => {
    const [cf] = articles(render([COM_FOTO]));
    expect(cf).toContain('aspect-[4/3]');
    expect(a).not.toContain('aspect-[4/3]');
  });
});

describe('sinal público no novo visual', () => {
  const [a] = articles(render([SINAL]));
  it('«Origem: notícia pública» e a fonte continuam; sem «Informar que encontrei»; sem foto → compacto', () => {
    expect(a).toContain('data-origin="sinal_publico"');
    expect(a).toContain('Origem: notícia pública');
    expect(a).toContain('Fonte: g1.globo.com');
    expect(a).not.toContain('Informar que encontrei');
    expect(a).toContain('data-photo="nao"');
  });
});

describe('o que NÃO muda', () => {
  it('endpoints, paginação e eventos seguem como estavam no cliente', () => {
    expect(src).toContain('/api/v1/feed${qs');
    expect(src).toContain("'/api/v1/feed/geo'");
    expect(src).toContain('Ver mais ocorrências');
    expect(src).toContain('Ver ocorrências anteriores');
    for (const ev of ['cardAberto', 'compartilhar', 'informarEncontreiClique', 'filtroAplicado', 'aberto']) expect(src).toContain(`feedEvents.${ev}`);
  });
  it('«Ver mais» continua sendo um link real para a próxima página', () => {
    const html = clean(renderToString(React.createElement(FeedClient, { initialItems: [COM_FOTO], initialNextCursor: 'x', initialHasMore: true, page: 1, regions: UFS })));
    expect(html).toContain('href="/feed/pagina/2"');
  });
});
