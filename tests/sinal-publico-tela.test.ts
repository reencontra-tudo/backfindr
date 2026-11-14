// /objeto/[code] de SINAL PÚBLICO: sem «Avisar o dono» (não há dono cadastrado); texto e fonte corretos. Objeto de usuário e do legado: tela de sempre.
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;
vi.mock('@/lib/db', () => ({ query: vi.fn(async () => { throw new Error('banco fora'); }) }));

import PublicObjectClient from '@/app/objeto/[code]/client';
import {
  SinalPublicoAcao, SinalPublicoBanner, cadastroHref, SINAL_TEXTO, SINAL_TEXTO_SEM_FONTE, SINAL_TITULO, SINAL_TITULO_SEM_FONTE,
  SINAL_BOTAO_FONTE, SINAL_BOTAO_AGREGADOR, SINAL_BOTAO_CADASTRAR,
} from '@/app/objeto/[code]/SinalPublico';
import { SIGNAL_SOURCE_SQL, getSignalSource, toSignalSource } from '@/lib/feed/signalSource';
import { FEED_SQL, sourceName } from '@/lib/feed/query';
import type { RegisteredObject } from '@/types';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const txt = (html: string) => html.replace(/<!-- -->/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
const obj = (o: Record<string, unknown> = {}) => ({
  id: 'obj-1', unique_code: 'ABC12345', title: 'Documento encontrado no bairro Colonial', description: 'Descrição pública.', status: 'found', category: 'document',
  photos: [], location: null, source: 'public_signal', is_legacy: false, ...o,
}) as unknown as RegisteredObject;
const render = (o: RegisteredObject, fonte?: ReturnType<typeof toSignalSource>) => txt(renderToString(React.createElement(PublicObjectClient, { obj: o, ...(fonte === undefined ? {} : { signalSource: fonte }) })));

const COMUM = toSignalSource('https://cgn.inf.br/noticia/2224709/documento-x')!;
const GOOGLE = toSignalSource('https://news.google.com/rss/articles/CBMiXXX')!;
const G1 = toSignalSource('https://g1.globo.com/pr/oeste/noticia/x.ghtml')!;
// frases que NÃO podem aparecer num sinal público (nenhuma promessa de dono, contato protegido, SMS, chat protegido ou resposta da fonte)
const PROIBIDAS = /Avisar o dono|O dono recebe um aviso|Este objeto pertence a alguém|é rápido e seguro|dono foi notificado|Dono recebe notifica|Enviando aviso|protegid|\bSMS\b|chat protegido|com seguran[çc]a|responder[áa]|vai responder|garant/i;

describe('fonte estruturada (a mesma do Feed)', () => {
  it('nome do veículo: hostname sem www; Google Notícias é marcado como agregador', () => {
    expect(COMUM).toEqual({ url: 'https://cgn.inf.br/noticia/2224709/documento-x', name: 'cgn.inf.br', agregador: false });
    expect(GOOGLE.name).toBe('Google Notícias'); expect(GOOGLE.agregador).toBe(true);
    expect(G1.name).toBe('g1.globo.com'); expect(G1.agregador).toBe(false);
    expect(sourceName('https://www.exemplo.com.br/a')).toBe('exemplo.com.br');
  });
  it('só link http(s) vale: nulo, lixo, javascript: e data: viram «sem fonte»', () => {
    for (const v of [null, undefined, '', 'javascript:alert(1)', 'data:text/html,x', 42, 'ftp://x']) expect(toSignalSource(v), String(v)).toBeNull();
  });
  it('a consulta usa as MESMAS condições da fonte nos cards do Feed (evidência aprovada, link http, a mais recente)', () => {
    for (const parte of ["e.status = 'approved'", "left(e.source_url, 4) = 'http'", 'ORDER BY e.created_at DESC LIMIT 1']) { expect(SIGNAL_SOURCE_SQL).toContain(parte); expect(FEED_SQL).toContain(parte); }
    expect(SIGNAL_SOURCE_SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });
  it('erro no banco → null (a tela cai na versão «sem fonte identificável»), nunca lança', async () => {
    await expect(getSignalSource('x')).resolves.toBeNull();
  });
});

describe('sinal público COM fonte comum', () => {
  const h = render(obj(), COMUM);
  it('mostra o título e o texto certos (uma vez)', () => {
    expect(h).toContain(SINAL_TITULO); expect(h).toContain(SINAL_TEXTO);
    expect(SINAL_TEXTO).toBe('Este conteúdo foi extraído de uma notícia pública. Não há dono cadastrado no Backfindr para este registro. Se quiser tentar contato, procure a fonte original e, se a notícia citar uma autoridade ou instituição, procure por ela.');
  });
  it('botão «Ver a notícia original» em nova aba, sem acesso ao opener, com «Fonte: <veículo>»', () => {
    expect(h).toMatch(/<a [^>]*href="https:\/\/cgn\.inf\.br\/noticia\/2224709\/documento-x"[^>]*>/);
    const a = h.match(/<a [^>]*data-sinal-fonte-link[^>]*>/)![0];
    expect(a).toContain('target="_blank"'); expect(a).toMatch(/rel="[^"]*noopener[^"]*"/); expect(a).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    expect(h).toContain(SINAL_BOTAO_FONTE); expect(h).toContain('Fonte: cgn.inf.br');
  });
  it('nenhuma das frases removidas nem promessa de contato protegido, SMS ou resposta', () => { expect(h).not.toMatch(PROIBIDAS); });
  it('mantém o cadastro da própria ocorrência (fluxo que já existe, com conta): achado → intent=lost, só a categoria preenchida', () => {
    expect(h).toContain(SINAL_BOTAO_CADASTRAR);
    expect(h).toContain('href="/auth/register?intent=lost&prefill_category=document"');
    expect(cadastroHref('lost', 'phone')).toBe('/auth/register?intent=found&prefill_category=phone');
    expect(cadastroHref('found', '')).toBe('/auth/register?intent=lost&prefill_category=other');
  });
  it('o resto da página continua (título do objeto, descrição, compartilhar)', () => {
    expect(h).toContain('Documento encontrado no bairro Colonial'); expect(h).toContain('Descrição pública.'); expect(h).toContain('Baixar Cartaz');
  });
});

describe('sinal público com fonte Google Notícias (agregador)', () => {
  const h = render(obj(), GOOGLE);
  it('mostra «Google Notícias» e NÃO afirma que leva à notícia original', () => {
    expect(h).toContain('Fonte: Google Notícias'); expect(h).toContain(SINAL_BOTAO_AGREGADOR);
    expect(h).not.toContain(SINAL_BOTAO_FONTE);
    expect(h).toContain('href="https://news.google.com/rss/articles/CBMiXXX"');
  });
  it('sem as frases removidas', () => { expect(h).not.toMatch(PROIBIDAS); });
});

describe('sinal público SEM fonte identificável', () => {
  const h = render(obj(), null);
  it('texto alternativo, sem link de fonte, com «Cadastrar minha ocorrência» no lugar', () => {
    expect(h).toContain(SINAL_TITULO_SEM_FONTE); expect(h).toContain(SINAL_TEXTO_SEM_FONTE);
    expect(SINAL_TEXTO_SEM_FONTE).toBe('Este conteúdo foi extraído de uma publicação pública que não conseguimos identificar. Não há dono cadastrado no Backfindr para este registro.');
    expect(h).not.toContain('data-sinal-fonte-link'); expect(h).not.toContain('Fonte:'); expect(h).not.toContain(SINAL_BOTAO_FONTE);
    expect(h).toContain(SINAL_BOTAO_CADASTRAR); expect(h).toContain('data-sinal-cadastrar');
  });
  it('sem as frases removidas, e sem a frase «procure a fonte original» (não há fonte)', () => {
    expect(h).not.toMatch(PROIBIDAS); expect(h).not.toContain('procure a fonte original');
  });
  it('sem a prop de fonte (esquecida) o comportamento é o mesmo: nunca volta o «Avisar o dono»', () => {
    const h2 = render(obj()); expect(h2).not.toMatch(PROIBIDAS); expect(h2).toContain(SINAL_TEXTO_SEM_FONTE);
  });
  it('componentes isolados: banner e ações', () => {
    const b = txt(renderToString(React.createElement(SinalPublicoBanner, { source: COMUM })));
    expect(b).toContain('data-sinal-publico'); expect(b).not.toMatch(PROIBIDAS);
    const a = txt(renderToString(React.createElement(SinalPublicoAcao, { source: null, status: 'lost', category: 'phone' })));
    expect(a).toContain('intent=found'); expect(a).not.toMatch(PROIBIDAS);
  });
});

describe('objeto de USUÁRIO e do LEGADO: tela de sempre', () => {
  const casos: [string, RegisteredObject][] = [
    ['usuário (perdido)', obj({ source: null, status: 'lost' })],
    ['usuário (source «user»)', obj({ source: 'user', status: 'lost' })],
    ['legado (webjetos)', obj({ source: 'webjetos', is_legacy: true, status: 'lost' })],
    ['legado (flag)', obj({ source: null, is_legacy: true, status: 'lost' })],
  ];
  for (const [nome, o] of casos) {
    it(`${nome}: mantém o botão e as frases atuais`, () => {
      const h = render(o);
      for (const f of ['Avisar o dono que encontrei', 'O dono recebe um aviso.', 'Este objeto pertence a alguém.', 'Objeto registrado na rede Backfindr', 'A conversa acontece pelo chat da plataforma.']) expect(h, f).toContain(f);
      expect(h).not.toContain('data-sinal-publico'); expect(h).not.toContain(SINAL_TITULO);
    });
  }
  it('legado continua com o selo «Compartilhado via Webjetos»', () => { expect(render(casos[2][1])).toContain('Compartilhado via Webjetos'); });
  it('a tela de usuário recebe o MESMO resultado com ou sem a prop de fonte (a prop só existe para sinal)', () => {
    expect(render(casos[0][1], COMUM)).toBe(render(casos[0][1]));
  });
});

describe('regras no código', () => {
  it('critério: o mesmo do Feed, da API e da máscara (source === public_signal); a página só busca a fonte para sinal', () => {
    expect(read('src/app/objeto/[code]/client.tsx')).toContain("const isSignal = obj.source === 'public_signal';");
    const p = read('src/app/objeto/[code]/page.tsx');
    expect(p).toContain("obj.source === 'public_signal' ? { signalSource: await getSignalSource(String(obj.id)) } : {}");
    expect(p).toContain('<PublicObjectClient obj={objTela} {...signalProps} />');   // objTela = o mesmo objeto, sem o endereço da fonte na descrição de sinal público
    expect(read('src/lib/objectPublicView.ts')).toContain("obj.source !== 'public_signal'");
  });
  it('a API pública do objeto NÃO mudou (a fonte vem direto do banco na página, não de um campo novo da API)', () => {
    const api = read('src/app/api/v1/objects/scan/[code]/route.ts');
    expect(api).not.toMatch(/signal_source|public_signal_evidence|source_url/);
  });
  it('nada fora do escopo: o texto de usuário/legado está no mesmo arquivo e inalterado', () => {
    const c = read('src/app/objeto/[code]/client.tsx');
    for (const f of ['Avisar o dono que encontrei', 'O dono recebe um aviso.', 'Este objeto pertence a alguém.']) expect(c).toContain(f);
  });
});
