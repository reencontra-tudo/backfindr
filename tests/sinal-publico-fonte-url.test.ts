// Sinal público: o endereço (URL) da fonte pode trazer nome de pessoa no caminho. O texto VISÍVEL de /objeto não mostra mais «Fonte: https://…»
// (só o nome do veículo e o botão «Ver a notícia original»). SEO (meta, JSON-LD), APIs e Feed ficam como estavam. Usuário e legado: idênticos.
// Os nomes usados aqui são inventados.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

const st = vi.hoisted(() => ({ fonte: null as string | null, obj: {} as Record<string, unknown> }));
vi.mock('@/lib/db', () => ({ query: vi.fn(async () => ({ rows: st.fonte ? [{ source_url: st.fonte }] : [] })) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));

import PublicObjectPage, { generateMetadata } from '@/app/objeto/[code]/page';
import PublicObjectClient from '@/app/objeto/[code]/client';
import FeedClient from '@/app/feed/FeedClient';
import { semEnderecoDeFonte, maskObjectForPublicPage } from '@/lib/objectPublicView';
import type { FeedItem } from '@/lib/feed/query';
import type { RegisteredObject } from '@/types';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const URL_NOME = 'https://cgn.inf.br/noticia/2224709/documento-em-nome-de-maria-souza-teste-foi-encontrado-no-colonial';
const URL_G1 = 'https://g1.globo.com/pr/oeste/noticia/2026/11/10/cachorro-encontrado-em-cascavel.ghtml';
const URL_GOOGLE = 'https://news.google.com/rss/articles/CBMiXXXXXXXX?oc=5';
const descricao = (u: string) => `Documento encontrado em nome de (nome omitido). Categoria: documento. Local: bairro Colonial, Cascavel, PR. Ocorrência identificada automaticamente a partir de canal institucional de achados e perdidos. Fonte: ${u}`;
const objApi = (o: Record<string, unknown> = {}) => ({
  id: 'obj-1', unique_code: 'ABC12345', title: 'Documento encontrado em nome de (nome omitido)', description: descricao(URL_NOME), status: 'found', category: 'document',
  photos: [], location: { address: 'bairro Colonial, Cascavel, PR' }, source: 'public_signal', is_legacy: false, created_at: '2026-11-10T10:00:00Z', ...o,
});
const txt = (h: string) => h.replace(/<!-- -->/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
async function pagina(o: Record<string, unknown>, fonte: string | null) {
  st.obj = o; st.fonte = fonte;
  const el = await PublicObjectPage({ params: { code: 'ABC12345' } });
  return txt(renderToString(el as React.ReactElement));
}
/** o que a pessoa lê: HTML sem scripts/estilos e sem tags */
const visivel = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
/** atributos de acessibilidade/rótulo (title, alt, aria-label), que também são lidos por leitor de tela */
const rotulos = (h: string) => (h.replace(/<script[\s\S]*?<\/script>/g, '').match(/\b(?:title|alt|aria-label)="[^"]*"/g) ?? []).join(' ');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: st.obj }) })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('semEnderecoDeFonte (função pura)', () => {
  it('tira «Fonte: <endereço>» e deixa o resto da descrição', () => {
    const r = semEnderecoDeFonte(descricao(URL_NOME));
    expect(r).toBe('Documento encontrado em nome de (nome omitido). Categoria: documento. Local: bairro Colonial, Cascavel, PR. Ocorrência identificada automaticamente a partir de canal institucional de achados e perdidos.');
    expect(r).not.toMatch(/http|Fonte:|maria|souza/i);
  });
  it('sem endereço: não muda nada (além de aparar espaços); nulo/vazio viram texto vazio', () => {
    expect(semEnderecoDeFonte('Cachorro encontrado no bairro X.')).toBe('Cachorro encontrado no bairro X.');
    expect(semEnderecoDeFonte(null)).toBe(''); expect(semEnderecoDeFonte(undefined)).toBe(''); expect(semEnderecoDeFonte('')).toBe('');
  });
  it('outros endereços soltos na descrição também saem (http e https, maiúsculas)', () => {
    expect(semEnderecoDeFonte('A. Veja HTTPS://exemplo.com/x-y-z e http://outro.com/a. Fim. Fonte: https://n.com/b')).not.toMatch(/http|exemplo|outro/i);
  });
  it('só tira endereços: texto com a palavra «fonte» sem endereço continua', () => {
    expect(semEnderecoDeFonte('A fonte da notícia não foi identificada.')).toBe('A fonte da notícia não foi identificada.');
  });
});

describe('/objeto de sinal público: nenhum endereço de fonte em texto visível nem em rótulo', () => {
  const casos: [string, string, string, string][] = [
    ['fonte comum com nome na URL', URL_NOME, 'Ver a notícia original', 'Fonte: cgn.inf.br'],
    ['fonte comum sem nome na URL (g1)', URL_G1, 'Ver a notícia original', 'Fonte: g1.globo.com'],
    ['fonte Google Notícias', URL_GOOGLE, 'Abrir no Google Notícias', 'Fonte: Google Notícias'],
  ];
  for (const [nome, url, botao, fonteTxt] of casos) {
    it(`${nome}: texto visível e rótulos sem «http»; o botão continua e o link funciona`, async () => {
      const h = await pagina(objApi({ description: descricao(url) }), url);
      expect(visivel(h)).not.toMatch(/https?:/i);
      expect(visivel(h)).not.toContain('Fonte: https');
      expect(rotulos(h)).not.toMatch(/https?:/i);
      expect(visivel(h)).toContain('Ocorrência identificada automaticamente a partir de canal institucional de achados e perdidos.');   // o resto da descrição fica
      expect(visivel(h)).toContain(botao); expect(visivel(h)).toContain(fonteTxt);
      const a = h.match(/<a [^>]*data-sinal-fonte-link[^>]*>/)![0];
      expect(a).toContain(`href="${url}"`.replace(/&/g, '&')); expect(a).toContain('target="_blank"'); expect(a).toMatch(/rel="noopener noreferrer nofollow"/);
      expect(a).not.toMatch(/\b(title|alt|aria-label)=/);          // o endereço não vai para atributo de texto alternativo
    });
  }
  it('o endereço aparece SÓ no href do botão (único atributo com a URL no HTML visível)', async () => {
    const h = await pagina(objApi(), URL_NOME);
    const semScripts = h.replace(/<script[\s\S]*?<\/script>/g, '');
    const hrefs = [...semScripts.matchAll(/(\w[\w-]*)="(https?:[^"]*cgn\.inf\.br[^"]*)"/g)];
    expect(hrefs.map((m) => m[1])).toEqual(['href']);
  });
  it('o nome que está no caminho da URL não aparece em lugar nenhum do texto visível', async () => {
    const h = await pagina(objApi(), URL_NOME);
    expect(visivel(h)).not.toMatch(/maria|souza/i); expect(rotulos(h)).not.toMatch(/maria|souza/i);
  });
  it('sinal SEM fonte identificável: sem endereço em lugar nenhum, texto alternativo e cadastro', async () => {
    const h = await pagina(objApi({ description: descricao(URL_NOME) }), null);
    expect(visivel(h)).not.toMatch(/https?:/i); expect(rotulos(h)).not.toMatch(/https?:/i);
    expect(visivel(h)).toContain('Este conteúdo foi extraído de uma publicação pública que não conseguimos identificar.');
    expect(h).not.toContain('data-sinal-fonte-link');
  });
  it('a trava e o bloco novo do #108 continuam (sem «Avisar o dono»)', async () => {
    const h = await pagina(objApi(), URL_NOME);
    expect(visivel(h)).toContain('Ocorrência extraída de notícia pública'); expect(visivel(h)).not.toMatch(/Avisar o dono|O dono recebe um aviso|pertence a alguém/);
  });
});

describe('o que NÃO muda neste PR: SEO (meta e JSON-LD), usuário e legado', () => {
  it('JSON-LD e meta description continuam gerados do objeto original (a decisão de mexer neles fica para depois)', async () => {
    const o = objApi();
    const h = await pagina(o, URL_NOME);
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
    expect(ld[0].description).toBe(o.description);                       // inalterado (ainda traz a «Fonte: <endereço>»)
    st.obj = o; const meta = await generateMetadata({ params: { code: 'ABC12345' } });
    expect(meta.description).toBe(`Achado: ${o.title} — bairro Colonial, Cascavel, PR. ${o.description}`.slice(0, 160));
  });
  const outros: [string, Record<string, unknown>][] = [
    ['usuário', { source: null, user_id: 'u1', description: 'Perdi na rua. Mais info em https://exemplo.com/meu-anuncio-123 obrigado' }],
    ['usuário (source «user»)', { source: 'user', description: 'Fonte: https://exemplo.com/a-b-c' }],
    ['legado (webjetos)', { source: 'webjetos', is_legacy: true, description: 'Ver https://webjetos.example/x/y-z' }],
  ];
  for (const [nome, extra] of outros) {
    it(`${nome}: tela idêntica à de antes (a descrição mantém o endereço que a pessoa escreveu)`, async () => {
      const o = objApi({ title: 'Mochila azul', status: 'lost', category: 'bag', ...extra });
      const h = await pagina(o, null);
      const direto = txt(renderToString(React.createElement(PublicObjectClient, { obj: maskObjectForPublicPage(o) as unknown as RegisteredObject })));
      // a página renderiza o MESMO que o componente recebendo o objeto sem alteração (menos o que a página acrescenta: script JSON-LD)
      expect(h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')).toBe(direto);
      expect(visivel(h)).toMatch(/https?:\/\//); expect(visivel(h)).toContain('Avisar o dono que encontrei');
    });
  }
});

describe('Feed: nenhum endereço em texto visível nem rótulo; link da fonte continua', () => {
  const item = (o: Partial<FeedItem>): FeedItem => ({
    code: 'S0000001', title: 'Documento encontrado em nome de (nome omitido)', status: 'found', status_label: 'Achado', category: 'document', category_label: 'Documento',
    origin: 'sinal_publico', location_label: 'Colonial, Cascavel - PR', has_photo: false, photo_url: null, created_at: '2026-11-10T10:00:00.000Z',
    source_url: URL_NOME, source_name: 'cgn.inf.br', can_report_found: false, ...o,
  });
  const card = (it: FeedItem) => txt(renderToString(React.createElement(FeedClient, { initialItems: [it], initialNextCursor: null, initialHasMore: false, page: 1, regions: ['SP'] })));
  it('sinal: texto visível «Fonte: <veículo>», sem http, sem title/alt/aria-label com o endereço; o href aponta para a notícia', () => {
    const h = card(item({}));
    expect(visivel(h)).toContain('Fonte: cgn.inf.br'); expect(visivel(h)).not.toMatch(/https?:/i); expect(rotulos(h)).not.toMatch(/https?:/i);
    const a = h.match(/<a [^>]*href="https:\/\/cgn\.inf\.br[^"]*"[^>]*>/)![0];
    expect(a).toContain('target="_blank"'); expect(a).toMatch(/rel="nofollow noopener noreferrer"/); expect(a).not.toMatch(/\b(title|alt|aria-label)=/);
  });
  it('Google Notícias: «Fonte: Google Notícias»; usuário: sem link de fonte', () => {
    const g = card(item({ source_url: URL_GOOGLE, source_name: 'Google Notícias' }));
    expect(visivel(g)).toContain('Fonte: Google Notícias'); expect(visivel(g)).not.toMatch(/https?:/i);
    const u = card(item({ origin: 'usuario', source_url: null, source_name: null, status: 'lost', status_label: 'Perdido', can_report_found: true }));
    expect(u).not.toContain('Origem: notícia pública'); expect(u).not.toMatch(/href="https?:/);
  });
  it('o Feed não foi alterado por este PR (código do card igual)', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    expect(c).toContain("<a href={item.source_url} target=\"_blank\" rel=\"nofollow noopener noreferrer\"");
    expect(c).toContain("Fonte{item.source_name ? `: ${item.source_name}` : ''}");
  });
});

describe('regras no código', () => {
  it('só o que a TELA recebe perde o endereço; metadados e JSON-LD seguem usando o objeto original', () => {
    const p = read('src/app/objeto/[code]/page.tsx');
    expect(p).toContain("const objTela = obj.source === 'public_signal' ? { ...obj, description: semEnderecoDeFonte(obj.description) } : obj;");
    expect(p).toContain('<PublicObjectClient obj={objTela} {...signalProps} />');
    expect(p).toContain('const jsonLd = buildJsonLd(obj);');
    expect(p).toMatch(/\$\{obj\.description \?\? ''\}/);               // generateMetadata continua com a descrição original
  });
  it('a API pública do objeto e a consulta do Feed não foram tocadas', () => {
    expect(read('src/app/api/v1/objects/scan/[code]/route.ts')).not.toMatch(/semEnderecoDeFonte/);
    expect(read('src/lib/feed/query.ts')).not.toMatch(/semEnderecoDeFonte/);
  });
});
