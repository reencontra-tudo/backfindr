// Feed: visual novo (faixa escura + folha clara) e as duas visualizações («Publicações» e «Grade»). Sem banco, sem navegador.
//   npx vitest@2 run --config tests/vitest.config.ts tests/feed-visualizacao.test.ts
import { describe, expect, it } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from 'react-dom/server';

(globalThis as unknown as { React: typeof React }).React = React;

import FeedClient from '@/app/feed/FeedClient';
import { TEMA_CLARO, TEMA_ESCURO, TEMA_ATIVO } from '@/app/feed/tema';
import {
  ALTURA_SEM_FOTO_GRADE, CHAVE_VISUALIZACAO, PROPORCAO_FOTO_GRADE, classesLargura, classesLista, lerVisualizacao, salvarVisualizacao, type Visualizacao,
} from '@/lib/feed/visualizacao';
import { criarEstado, validarEstado } from '@/lib/feed/estado';
import type { FeedItem } from '@/lib/feed/query';

const UFS = ['DF', 'PE', 'SP'];
const mk = (o: Partial<FeedItem>): FeedItem => ({
  code: 'T0000001', title: 'Celular azul perdido', status: 'lost', status_label: 'Perdido', category: 'phone', category_label: 'Celular',
  origin: 'usuario', location_label: 'Recife - PE', has_photo: true, photo_url: 'https://pub-test.r2.dev/a.jpg',
  created_at: '2026-11-10T10:00:00.000Z', source_url: null, source_name: null, can_report_found: true, ...o,
});
const COM_FOTO = mk({});
const SEM_FOTO = mk({ code: 'T0000002', title: 'Carteira de identidade', category: 'document', has_photo: false, photo_url: null });
const SINAL = mk({ code: 'T0000003', origin: 'sinal_publico', status: 'stolen', status_label: 'Roubado', can_report_found: false, has_photo: false, photo_url: null, source_url: 'https://g1.globo.com/x', source_name: 'g1.globo.com' });
const ITENS = [COM_FOTO, SEM_FOTO, SINAL, mk({ code: 'T0000004', title: 'Achado: chaves', status: 'found', status_label: 'Achado', can_report_found: false }) ];

const clean = (html: string) => html.replace(/<!-- -->/g, '');
const render = (vis?: Visualizacao, items = ITENS, page = 1) => clean(renderToString(React.createElement(FeedClient, {
  initialItems: items, initialNextCursor: null, initialHasMore: false, page, regions: UFS, visInicial: vis })));
const articles = (html: string) => html.split('<article').slice(1).map((a) => '<article' + a.split('</article>')[0]);
const read = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
const memoria = (inicial: Record<string, string> = {}) => {
  const m = { ...inicial };
  return { m, st: { getItem: (k: string) => (k in m ? m[k] : null), setItem: (k: string, v: string) => { m[k] = v; }, removeItem: (k: string) => { delete m[k]; } } };
};

describe('preferência de visualização (localStorage)', () => {
  it('salva e lê as duas opções, com chave versionada', () => {
    expect(CHAVE_VISUALIZACAO).toBe('feed-visualizacao-v1');
    for (const v of ['publicacoes', 'grade'] as const) {
      const { st, m } = memoria();
      expect(salvarVisualizacao(st, v)).toBe(true);
      expect(m[CHAVE_VISUALIZACAO]).toBe(v);
      expect(lerVisualizacao(st)).toBe(v);
    }
  });
  it('nada guardado = null; valor inválido é descartado (apagado) e vira null', () => {
    expect(lerVisualizacao(memoria().st)).toBeNull();
    for (const lixo of ['', 'lista', 'GRADE', '{"a":1}', 'null', 'x'.repeat(5000)]) {
      const { st, m } = memoria({ [CHAVE_VISUALIZACAO]: lixo });
      expect(lerVisualizacao(st), lixo.slice(0, 10)).toBeNull();
      expect(CHAVE_VISUALIZACAO in m).toBe(false);
    }
  });
  it('localStorage indisponível (null) ou que lança erro: nunca quebra e nunca lança', () => {
    expect(lerVisualizacao(null)).toBeNull();
    expect(salvarVisualizacao(null, 'grade')).toBe(false);
    const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cota'); }, removeItem: () => { throw new Error('x'); } };
    expect(lerVisualizacao(quebrado)).toBeNull();
    expect(salvarVisualizacao(quebrado, 'grade')).toBe(false);
    const soRemoveFalha = { getItem: () => 'lixo', setItem: () => {}, removeItem: () => { throw new Error('x'); } };
    expect(lerVisualizacao(soRemoveFalha)).toBeNull();
  });
  it('não grava valor fora da lista', () => {
    const { st, m } = memoria();
    expect(salvarVisualizacao(st, 'outra' as unknown as Visualizacao)).toBe(false);
    expect(Object.keys(m)).toHaveLength(0);
  });
  it('o padrão e o que o servidor desenha é «Publicações» (a Grade só entra no navegador, depois de carregar)', () => {
    const html = render();
    expect(html).toContain('data-vis="publicacoes"');
    expect(html).not.toContain('data-vis="grade"');
    expect(read('src/app/feed/[[...slug]]/page.tsx')).not.toContain('visInicial');
  });
});

describe('classes por visualização', () => {
  it('Publicações: pilha com separadores, coluna estreita', () => {
    expect(classesLista('publicacoes', false)).toContain('divide-y');
    expect(classesLista('publicacoes', false)).not.toContain('grid-cols');
    expect(classesLargura('publicacoes')).toContain('max-w-2xl');
  });
  it('Grade: 2 colunas no celular, 3 no tablet (a partir de 560 px) e 4 no desktop largo (a partir de 1024 px)', () => {
    const c = classesLista('grade', false);
    expect(c).toContain('grid-cols-2'); expect(c).toContain('min-[560px]:grid-cols-3'); expect(c).toContain('lg:grid-cols-4');
    expect(c).not.toContain('divide-y');
    expect(classesLargura('grade')).toContain('max-w-6xl');
  });
  it('lista ocupada esmaece nas duas visualizações', () => {
    for (const v of ['publicacoes', 'grade'] as const) { expect(classesLista(v, true)).toContain('opacity-60'); expect(classesLista(v, false)).not.toContain('opacity-60'); }
  });
  it('a lista renderizada usa as classes da visualização', () => {
    expect(render('grade')).toContain(`class="${classesLista('grade', false)}"`);
    expect(render('publicacoes')).toContain(`class="${classesLista('publicacoes', false)}"`);
  });
});

describe('seletor «Publicações» / «Grade»', () => {
  it('dois botões de 44 px com nome acessível e estado (aria-pressed)', () => {
    for (const v of ['publicacoes', 'grade'] as const) {
      const h = render(v);
      const grupo = h.split('aria-label="Visualização"')[1].split('</div>')[0];
      const botoes = grupo.match(/<button[^>]*>/g)!;
      expect(botoes).toHaveLength(2);
      expect(grupo).toContain('aria-label="Publicações"'); expect(grupo).toContain('aria-label="Grade"');
      for (const b of botoes) { expect(b).toContain('h-11 w-11'); expect(b).toContain('type="button"'); }
      expect(botoes.filter((b) => b.includes('aria-pressed="true"'))).toHaveLength(1);
      expect(botoes.find((b) => b.includes('aria-pressed="true"'))).toContain(`data-vis-botao="${v}"`);
    }
  });
  it('trocar a visualização não chama a rede: o código do clique só muda estado, guarda a preferência e registra o evento', () => {
    const src = read('src/app/feed/FeedClient.tsx');
    const fn = src.slice(src.indexOf('const escolherVis'), src.indexOf('const apply ='));
    expect(fn).not.toMatch(/fetch|reload|loadMore|fetchFeed/);
    expect(fn).toContain('salvarVisualizacao'); expect(fn).toContain('feedEvents.visualizacaoAlterada(v)');
  });
  it('evento novo feed_visualizacao_alterada com «publicacoes» ou «grade»', () => {
    const a = read('src/lib/feed/analytics.ts');
    expect(a).toContain("send('feed_visualizacao_alterada', { visualizacao })");
  });
});

describe('cards da Grade', () => {
  const grade = articles(render('grade'));
  it('mesmos cards, na mesma ordem, com o mesmo título e link nas duas visualizações', () => {
    const pub = articles(render('publicacoes'));
    expect(grade).toHaveLength(pub.length);
    const codigos = (a: string[]) => a.map((x) => x.match(/data-code="([^"]+)"/)![1]);
    expect(codigos(grade)).toEqual(codigos(pub)); expect(codigos(grade)).toEqual(ITENS.map((i) => i.code));
    for (const [i, it] of ITENS.entries()) {
      expect(grade[i]).toContain(`href="/objeto/${it.code}"`); expect(grade[i]).toContain(it.title);
      expect(pub[i]).toContain(`href="/objeto/${it.code}"`); expect(pub[i]).toContain(it.title);
    }
  });
  it('com foto: foto 4:3 no topo e selo da situação no canto inferior esquerdo da foto', () => {
    const a = grade[0];
    expect(a).toContain(PROPORCAO_FOTO_GRADE); expect(a).toContain('<img');
    expect(a).toMatch(/absolute bottom-2 left-2[^"]*"[^>]*>Perdido</);
  });
  it('card SEM foto: faixa de mídia BAIXA (h-20) com ícone da categoria e cor suave, bem mais baixa que a foto 4:3; com foto continua 4:3', () => {
    const midia = (a: string) => a.match(/<div class="relative w-full overflow-hidden ([^"]*)"/)![1];
    expect(midia(grade[0])).toContain('aspect-[4/3]');
    for (const i of [1, 2]) { expect(midia(grade[i])).toContain(ALTURA_SEM_FOTO_GRADE); expect(midia(grade[i])).not.toContain('aspect-'); expect(midia(grade[i])).toContain('--f-'); }
    expect(ALTURA_SEM_FOTO_GRADE).toBe('h-20');   // 80 px (a foto 4:3 passa de 100 px em qualquer largura da Grade)
    expect(grade[1]).not.toContain('<img'); expect(grade[1]).toContain('<svg');
    expect(grade[1]).toMatch(/<span class="flex h-full w-full items-center justify-end [^"]*" aria-hidden="true"><svg/);   // ícone visível dentro da faixa
  });
  it('sem espaço vazio forçado no card: nada de altura mínima no título e «Encontrei» só aparece quando existe', () => {
    for (const a of grade) { expect(a).not.toMatch(/min-h-\[(?!44)/); }
    expect(grade[1]).not.toMatch(/h-\[(1\d\d|2\d\d)px\]/);
  });
  it('em Publicações o card sem foto continua compacto (sem bloco 4:3)', () => {
    const pub = articles(render('publicacoes'));
    expect(pub[1]).not.toContain('aspect-[4/3]'); expect(pub[0]).toContain('aspect-[4/3]');
    expect(pub[1]).toContain('h-9 w-9');
  });
  it('Perdido, Achado e Roubado têm três cores de selo diferentes', () => {
    const selo = (a: string) => a.match(/absolute bottom-2 left-2 rounded-full[^"]*(bg-\[color:var\(--f-(?:perdido|achado|roubado)\)\])/)![1];
    expect(new Set([selo(grade[0]), selo(grade[3]), selo(grade[2])]).size).toBe(3);
  });
  it('«Informar que encontrei» só em perdido de usuário; sinais e roubado nunca', () => {
    expect(grade[0]).toContain('Informar que encontrei'); expect(grade[1]).toContain('Informar que encontrei');
    expect(grade[2]).not.toContain('Informar que encontrei'); expect(grade[3]).not.toContain('Informar que encontrei');
    const roubadoUsuario = articles(render('grade', [mk({ code: 'T0000009', status: 'stolen', status_label: 'Roubado', can_report_found: true })]))[0];
    expect(roubadoUsuario).not.toContain('Informar que encontrei'); expect(roubadoUsuario).not.toContain('>Encontrei<');
  });
  it('Grade: rótulo visível «Encontrei», nome acessível «Informar que encontrei», mesmo destino, 1 linha e 44 px', () => {
    const tag = grade[0].match(/<a[^>]*href="\/achei\?ref=feed"[^>]*>/)![0];
    expect(tag).toContain('aria-label="Informar que encontrei"'); expect(grade[0]).toMatch(/href="\/achei\?ref=feed">Encontrei<\/a>/);
    expect(tag).toContain('min-h-[44px]'); expect(tag).toContain('whitespace-nowrap'); expect(tag).not.toContain('whitespace-normal');
    expect(read('src/app/feed/FeedClient.tsx')).toContain('feedEvents.informarEncontreiClique()');
  });
  it('Publicações: abaixo de 440 px «Compartilhar» vira só o ícone (nome acessível mantido) para as três ações caberem na mesma linha', () => {
    const p0 = articles(render('publicacoes'))[0];
    const share = p0.match(/<button[^>]*>/g)!.find((t) => t.includes('Compartilhar') || t.includes('max-[439px]'))!;
    expect(share).toContain('max-[439px]:w-11'); expect(share).toContain('max-[439px]:text-[0px]'); expect(share).toContain('min-h-[44px]');
    expect(p0).toMatch(/Compartilhar<\/button>/);   // o texto continua no HTML (nome acessível)
  });
  it('Publicações: «Informar que encontrei» fica à ESQUERDA da linha de ações (order-first), sem mudar a ordem no HTML nem ocupar linha sozinho', () => {
    const p0 = articles(render('publicacoes'))[0];
    const tag = p0.match(/<a [^>]*href="\/achei\?ref=feed"[^>]*>/)![0];
    expect(tag).toContain('order-first');
    const x = p0.slice(p0.lastIndexOf('<div class="mt-3 flex flex-wrap'));
    expect(x.indexOf('Ver detalhes')).toBeLessThan(x.indexOf('Informar que encontrei'));   // no HTML a ordem de sempre
    expect(x).not.toContain('grid-cols'); expect(x).not.toContain('col-span-2');
  });
  it('Publicações: rótulo completo «Informar que encontrei» (visível e acessível), mesma linha das outras ações', () => {
    const p0 = articles(render('publicacoes'))[0];
    expect(p0).toMatch(/href="\/achei\?ref=feed">Informar que encontrei<\/a>/);
  });
  it('sinal mostra «Fonte: <veículo>» pequena e nunca o endereço', () => {
    expect(grade[2]).toContain('Fonte: g1.globo.com'); expect(grade[2]).not.toContain('https://g1.globo.com'); expect(grade[2]).not.toContain('target="_blank"');
  });
  it('sem coração, lupa nem barra inferior', () => {
    const h = grade.join('');
    expect(h).not.toMatch(/heart|Heart|favorit/i); expect(h).not.toContain('lucide-search');
  });
  it('botão de compartilhar é só ícone, 44 px, mas mantém o nome acessível', () => {
    expect(grade[0]).toMatch(/<button[^>]*h-11 w-11[^>]*text-\[0px\][^>]*>[\s\S]*?Compartilhar/);
  });
});

describe('bloco «O Backfindr vai além das publicações»', () => {
  const muitos = Array.from({ length: 5 }, (_, i) => mk({ code: `T10000${i}`, title: `Item ${i}` }));
  it('só na página 1, depois do 3º card, uma vez; linha inteira na Grade', () => {
    const h = render('grade', muitos, 1);
    expect((h.match(/data-feed-about/g) ?? []).length).toBe(1);
    expect(h.indexOf('data-feed-about')).toBeGreaterThan(h.indexOf('Item 2')); expect(h.indexOf('data-feed-about')).toBeLessThan(h.indexOf('Item 3'));
    expect(h).toMatch(/<aside[^>]*col-span-full[^>]*data-feed-about/);
    expect(render('grade', muitos, 2)).not.toContain('data-feed-about');
  });
  it('em Publicações não usa col-span-full e o texto é o mesmo', () => {
    const h = render('publicacoes', muitos, 1);
    expect(h).not.toContain('col-span-full'); expect(h).toContain('O Backfindr vai além das publicações');
    expect(render('grade', muitos, 1)).toContain('Pesquise por localização e características e descubra possíveis correspondências entre o que foi perdido e o que foi encontrado.');
  });
});

describe('restaurar «voltar» guarda a visualização sem invalidar estados antigos', () => {
  const base = { agora: 1_000, pagina: 1, itens: [COM_FOTO], cursor: null, temMais: false, autoLotes: 0, filtros: { status: 'all', category: 'all', region: 'todas', geo: null }, scrollY: 10 };
  const ctx = { agora: 1_500, pagina: 1, regioes: UFS };
  it('guarda «grade» e «publicacoes»; estado antigo (sem vis) continua válido; vis estranho só perde o campo', () => {
    expect(validarEstado(JSON.parse(JSON.stringify(criarEstado({ ...base, vis: 'grade' }))), ctx)?.vis).toBe('grade');
    const antigo = JSON.parse(JSON.stringify(criarEstado(base))); expect('vis' in antigo).toBe(false);
    expect(validarEstado(antigo, ctx)).not.toBeNull();
    const estranho = { ...JSON.parse(JSON.stringify(criarEstado(base))), vis: 'lista' };
    const v = validarEstado(estranho, ctx); expect(v).not.toBeNull(); expect(v?.vis).toBeUndefined();
  });
});

describe('tema: uma constante, um tema por vez, contraste WCAG AA', () => {
  const hex = (c: string) => { const n = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
  const lum = (c: string) => { const [r, g, b] = hex(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const razao = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const T = TEMA_CLARO;
  const pares: Array<[string, string, string, number]> = [
    ['texto principal na folha', T['--f-t1'], T['--f-folha'], 4.5], ['texto secundário na folha', T['--f-t2'], T['--f-folha'], 4.5],
    ['meta (local, tempo, fonte) na folha', T['--f-t3'], T['--f-folha'], 4.5], ['meta no bloco explicativo', T['--f-t3'], T['--f-aviso'], 4.5],
    ['texto secundário no bloco explicativo', T['--f-t2'], T['--f-aviso'], 4.5], ['texto principal no bloco explicativo', T['--f-t1'], T['--f-aviso'], 4.5],
    ['texto principal no campo', T['--f-t1'], T['--f-campo'], 4.5], ['chip ativo', T['--f-chip-ativo-t'], T['--f-chip-ativo'], 4.5],
    ['botão principal', T['--f-prim-t'], T['--f-prim'], 4.5], ['botão principal (hover)', T['--f-prim-t'], T['--f-prim-hover'], 4.5],
    ['link de ação na folha', T['--f-acao-t'], T['--f-folha'], 4.5], ['link de ação no bloco', T['--f-acao-t'], T['--f-aviso'], 4.5],
    ['Perdido (texto) na folha', T['--f-perdido'], T['--f-folha'], 4.5], ['Achado (texto) na folha', T['--f-achado'], T['--f-folha'], 4.5], ['Roubado (texto) na folha', T['--f-roubado'], T['--f-folha'], 4.5],
    ['selo Perdido', T['--f-selo-t'], T['--f-perdido'], 4.5], ['selo Achado', T['--f-selo-t'], T['--f-achado'], 4.5], ['selo Roubado', T['--f-selo-t'], T['--f-roubado'], 4.5],
    ['ícone Perdido no card sem foto', T['--f-perdido'], T['--f-perdido-suave'], 4.5], ['ícone Achado no card sem foto', T['--f-achado'], T['--f-achado-suave'], 4.5], ['ícone Roubado no card sem foto', T['--f-roubado'], T['--f-roubado-suave'], 4.5],
    ['contorno de controles (componente, 3:1)', T['--f-borda'], T['--f-folha'], 3], ['anel de foco (3:1)', T['--f-foco'], T['--f-folha'], 3],
    ['texto da faixa', T['--f-faixa-t'], T['--f-faixa'], 4.5],
  ];
  it.each(pares)('%s', (_n, fg, bg, min) => { expect(razao(fg, bg)).toBeGreaterThanOrEqual(min); });
  it('o tema ativo é o claro; voltar ao escuro de hoje é trocar UMA constante; as duas listas têm as mesmas variáveis', () => {
    expect(TEMA_ATIVO).toBe(TEMA_CLARO);
    expect(Object.keys(TEMA_ESCURO).sort()).toEqual(Object.keys(TEMA_CLARO).sort());
    expect(read('src/app/feed/tema.ts')).toMatch(/export const TEMA_ATIVO: TemaFeed = TEMA_CLARO;/);
  });
  it('não existe seletor claro/escuro para o visitante', () => {
    const c = read('src/app/feed/FeedClient.tsx') + read('src/app/feed/FeedCta.tsx') + read('src/app/feed/[[...slug]]/page.tsx');
    expect(c).not.toMatch(/prefers-color-scheme|modo escuro|tema claro|Alternar tema/i);
  });
  it('o tema só se aplica na página do Feed (um style no <main>); o layout do site não é tocado', () => {
    expect(read('src/app/feed/[[...slug]]/page.tsx')).toContain('style={temaStyle()}');
    expect(read('src/app/layout.tsx')).not.toContain('--f-');
  });
});

describe('card inteiro clicável (um único link por card, sem elementos interativos aninhados)', () => {
  const por = (v: Visualizacao) => articles(render(v));
  it('o link do título cobre o card (::after inset-0) e é o mesmo destino de sempre', () => {
    for (const v of ['publicacoes', 'grade'] as const) for (const [i, a] of por(v).entries()) {
      const links = a.match(/<a [^>]*after:inset-0[^>]*>/g) ?? [];
      expect(links, `${v} card ${i}`).toHaveLength(1);
      expect(links[0]).toContain(`href="/objeto/${ITENS[i].code}"`);
      expect(a).toMatch(/^<article class="relative /);   // o card é o referencial do ::after
    }
  });
  it('compartilhar, «Informar que encontrei», «Ver detalhes» e o link da fonte ficam por cima (z-10)', () => {
    for (const v of ['publicacoes', 'grade'] as const) for (const a of por(v)) {
      for (const t of a.match(/<button[^>]*>/g) ?? []) if (t.includes('Compartilhar') || t.includes('text-[0px]') || t.includes('quiet')) expect(t).toContain('z-10');
      const botoesShare = a.match(/<button[^>]*class="[^"]*"[^>]*>/g) ?? [];
      for (const t of botoesShare) expect(t, t.slice(0, 90)).toContain('z-10');
      for (const t of a.match(/<a [^>]*href="(\/achei|https?:)[^>]*>/g) ?? []) expect(t).toContain('z-10');
    }
    expect(por('publicacoes')[0]).toMatch(/<a [^>]*aria-label="Ver detalhes: [^"]*"[^>]*z-10|<a [^>]*z-10[^>]*aria-label="Ver detalhes/);
  });
  it('nenhum link ou botão dentro de outro (HTML válido, foco correto)', () => {
    for (const v of ['publicacoes', 'grade'] as const) for (const a of por(v)) {
      for (const m of a.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)) expect(m[1]).not.toMatch(/<a |<button/);
      for (const m of a.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)) expect(m[1]).not.toMatch(/<a |<button/);
    }
  });
  it('o evento de abertura continua no link do título (um toque = um evento) e o compartilhar não passa por ele', () => {
    const src = read('src/app/feed/FeedClient.tsx');
    expect((src.match(/feedEvents\.cardAberto\(item\.origin\)/g) ?? []).length).toBe(3);   // título (Grade), título e «Ver detalhes» (Publicações): um por link
    expect(src).not.toMatch(/<article[^>]*onClick/);                                        // o card em si não tem onClick (o toque cai no link)
  });
});

describe('topo e filtros mais limpos', () => {
  const h = render('publicacoes');
  it('Categoria e Região lado a lado, sem rótulo visível, com nome acessível e a 1ª opção «todas»', () => {
    const area = h.slice(h.indexOf('aria-label="Filtros do Feed"'));
    expect(area).not.toMatch(/<label/);
    expect(area).toMatch(/<div class="grid grid-cols-2 gap-2"><select aria-label="Categoria"[\s\S]*?<option value="all"[^>]*>Todas as categorias<\/option>[\s\S]*?<select aria-label="Cidade ou região"[\s\S]*?<option value="todas"[^>]*selected[^>]*>Todas as regiões<\/option>/);
  });
  it('seletor de visualização em linha própria, à direita, fora da linha dos chips', () => {
    const chips = h.split('aria-label="Situação"')[1].split('aria-label="Visualização"')[0];
    expect(chips).not.toContain('data-vis-botao');
    expect(h).toMatch(/<div role="group" aria-label="Visualização" class="flex justify-end gap-1">/);
  });
  it('aviso de recorte: uma linha pequena e cinza com «Ver histórico no mapa» (link /map), perto dos filtros', () => {
    expect(h).toMatch(/<p class="my-1 text-xs [^"]*">Esta lista é só um recorte recente\. <a [^>]*href="\/map"[^>]*>Ver histórico no mapa<\/a><\/p>/);
    expect(h.indexOf('Esta lista é só um recorte recente')).toBeGreaterThan(h.indexOf('aria-label="Cidade ou região"'));
    expect(h.indexOf('Esta lista é só um recorte recente')).toBeLessThan(h.indexOf('<article'));
  });
  it('a geolocalização continua só ao escolher «Perto de mim» / «Só a minha cidade» (nada novo no carregamento)', () => {
    const src = read('src/app/feed/FeedClient.tsx');
    expect((src.match(/detectGeo\(/g) ?? []).length).toBe(2);
  });
  it('chips «Todos / Perdidos / Achados / Roubados» continuam, com degradê (#109)', () => {
    for (const t of ['>Todos<', '>Perdidos<', '>Achados<', '>Roubados<']) expect(h).toContain(t);
    expect(h).toContain('[background-attachment:local,local,scroll,scroll]');
  });
});

describe('título da página e cabeçalho', () => {
  const page = read('src/app/feed/[[...slug]]/page.tsx');
  it('H1 e título da aba: «Feed de ocorrências»; canonical, noindex 2+ e descrição como estavam', () => {
    expect(page).toContain("const TITLE = 'Feed de ocorrências de objetos perdidos e achados'");
    expect(page).toContain('>Feed de ocorrências</h1>');
    expect(page).not.toMatch(/Ocorrências recentes<\/h1>/);
    expect(page).toContain('alternates: { canonical: `${APP_URL}/feed` }');
    expect(page).toContain("robots: page === 1 ? { index: true, follow: true } : { index: false, follow: true }");
    expect(page).toContain("const DESCRIPTION = 'Veja ocorrências de objetos, documentos e pets perdidos, achados ou roubados registradas no Backfindr, e compartilhe para ajudar na devolução.';");
    expect(page).not.toMatch(/const DESCRIPTION = '[^']*(recentes|completa|todas as)/i);   // sem «mais recentes» nem sugestão de lista completa
    expect(page).toMatch(/\n\s+description: DESCRIPTION,\n\s+alternates/); expect(page).toContain('openGraph: { title: `${TITLE} | Backfindr`, description: DESCRIPTION,');   // meta e og usam a mesma frase
    expect(page).toContain("openGraph: { title: `${TITLE} | Backfindr`");
  });
  it('chamada curta «Perdeu ou encontrou algo?» com «Perdi» e «Encontrei» só na página 1; o caminho «Roubaram algo meu» continua nos menus', async () => {
    expect(page).toContain('{page === 1 && (');
    expect(page).toContain('Perdeu ou encontrou algo?');
    const cta = read('src/app/feed/FeedCta.tsx');
    expect(cta).toContain('Roubaram algo meu'); expect(cta).toContain('feedEvents.ctaRoubado(posicao, pagina)');
    const { TopoBotoes } = await import('@/app/feed/FeedCta');
    const t = clean(renderToString(React.createElement(TopoBotoes, { pagina: 1 })));
    const [perdi, encontrei] = t.match(/<a [^>]*>[^<]*<\/a>/g)!;
    expect(perdi).toContain('href="/flow/lost?ref=feed"'); expect(perdi).toContain('aria-label="Perdi algo"'); expect(perdi).toMatch(/>Perdi<\/a>$/);
    expect(encontrei).toContain('href="/flow/found?ref=feed"'); expect(encontrei).toContain('aria-label="Encontrei algo"'); expect(encontrei).toMatch(/>Encontrei<\/a>$/);
    expect((t.match(/min-h-\[44px\]/g) ?? []).length).toBe(2);
    expect(cta).toContain("feedEvents.ctaPerdi('topo', pagina)"); expect(cta).toContain("feedEvents.ctaEncontrei('topo', pagina)");
  });
  it('«Roubaram algo meu» continua no menu «Cadastrar ocorrência» (cabeçalho e botão fixo), com o destino e o evento de sempre, e visível ao abrir', async () => {
    const { RegisterMenu } = await import('@/app/feed/FeedCta');
    for (const variant of ['header', 'fixed'] as const) {
      const h = clean(renderToString(React.createElement(RegisterMenu, { variant, pagina: 1 })));
      const link = h.match(/<a [^>]*>Roubaram algo meu<\/a>/)![0];
      expect(link).toContain('href="/flow/stolen?ref=feed"'); expect(link).not.toMatch(/\bhidden\b|aria-hidden|display:none/);
    }
  });
  it('balão do assistente: regra só nesta página (fundo sólido, anel e sombra); posição e comportamento não mudam', () => {
    expect(page).toContain('button[aria-label="Abrir assistente"]{background-color:#0f766e !important');
    expect(page).toContain('dangerouslySetInnerHTML={{ __html: \'button[aria-label=');   // sem escape de aspas: o CSS chega válido e sem diferença na hidratação
    expect(read('src/components/AssistantWidget.tsx')).toContain('aria-label="Abrir assistente"');
  });
});
