// Filtros de categoria do mapa com HIERARQUIA (decisão do fundador, 24/11/2026): Animal ⊃ Pet; Eletrônico ⊃ Celular; «book», nula e desconhecida em «Outro».
// A hierarquia vive SÓ em src/lib/categorias.ts. Estes testes falham se Pet passar a mostrar «animal», se Celular passar a mostrar «electronics», etc.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  CATEGORIAS, CATEGORIA_MAE, OPCOES_FILTRO_CATEGORIA, categoriaEAscendentes, categoriaParaFiltro, categoriasDoFiltro, pertenceAoFiltro, rotuloDaCategoria,
} from '@/lib/categorias';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

// Distribuição REAL do mapa de produção em 24/11/2026 (API /api/v1/objects/map: 1.610 itens). «found»/«lost» são as categorias nulas (o mapa mostra o `type`).
const MAPA: Record<string, number> = {
  vehicle: 684, animal: 276, other: 186, pet: 181, electronics: 129, document: 75, wallet: 20, phone: 18, jewelry: 14, keys: 11, bag: 11, book: 2, found: 2, lost: 1,
};
const itens = () => Object.entries(MAPA).flatMap(([categoria, n]) => Array.from({ length: n }, () => categoria));
const conta = (filtro: string, lista: string[] = itens()) => lista.filter((c) => pertenceAoFiltro(c, filtro)).length;

describe('hierarquia', () => {
  it('só duas relações existem: pet → animal e phone → electronics', () => {
    expect(CATEGORIA_MAE).toEqual({ pet: 'animal', phone: 'electronics' });
  });
  it('categoriaEAscendentes: da mais específica para a mãe', () => {
    expect(categoriaEAscendentes('pet')).toEqual(['pet', 'animal']);
    expect(categoriaEAscendentes('phone')).toEqual(['phone', 'electronics']);
    expect(categoriaEAscendentes('animal')).toEqual(['animal']);
    expect(categoriaEAscendentes('vehicle')).toEqual(['vehicle']);
  });
  it('categoriasDoFiltro: a mãe inclui as filhas; a filha só ela mesma', () => {
    expect(categoriasDoFiltro('animal').sort()).toEqual(['animal', 'pet']);
    expect(categoriasDoFiltro('electronics').sort()).toEqual(['electronics', 'phone']);
    expect(categoriasDoFiltro('pet')).toEqual(['pet']);
    expect(categoriasDoFiltro('phone')).toEqual(['phone']);
  });
});

describe('quem aparece em cada filtro', () => {
  it('Pet mostra SÓ pet: NUNCA «animal» (nem todo animal é pet: cavalo roubado não é pet)', () => {
    expect(pertenceAoFiltro('pet', 'pet')).toBe(true);
    expect(pertenceAoFiltro('animal', 'pet')).toBe(false);
  });
  it('Animal mostra animal + pet', () => {
    expect(pertenceAoFiltro('animal', 'animal')).toBe(true);
    expect(pertenceAoFiltro('pet', 'animal')).toBe(true);
    expect(pertenceAoFiltro('vehicle', 'animal')).toBe(false);
  });
  it('Celular mostra SÓ phone (não mostra electronics)', () => {
    expect(pertenceAoFiltro('phone', 'phone')).toBe(true);
    expect(pertenceAoFiltro('electronics', 'phone')).toBe(false);
  });
  it('Eletrônico mostra electronics + phone', () => {
    expect(pertenceAoFiltro('electronics', 'electronics')).toBe(true);
    expect(pertenceAoFiltro('phone', 'electronics')).toBe(true);
    expect(pertenceAoFiltro('pet', 'electronics')).toBe(false);
  });
  it('«book», nula e desconhecida (found, lost, texto qualquer) aparecem em Outro, e só nele', () => {
    for (const c of ['book', null, undefined, '', 'found', 'lost', 'qualquer-coisa']) {
      expect(pertenceAoFiltro(c as string, 'other'), String(c)).toBe(true);
      expect(pertenceAoFiltro(c as string, 'pet'), String(c)).toBe(false);
      expect(pertenceAoFiltro(c as string, 'animal'), String(c)).toBe(false);
      expect(pertenceAoFiltro(c as string, 'electronics'), String(c)).toBe(false);
    }
    expect(categoriaParaFiltro('BOOK')).toBe('other');
  });
  it('sem filtro (vazio) mostra tudo', () => { for (const c of ['pet', 'animal', null, 'book']) expect(pertenceAoFiltro(c as string, '')).toBe(true); });
  it('as demais categorias continuam com filtro exato (nada mudou para elas)', () => {
    for (const c of ['wallet', 'keys', 'bag', 'bike', 'vehicle', 'document', 'jewelry', 'clothing']) {
      for (const f of CATEGORIAS) expect(pertenceAoFiltro(c, f), `${c} em ${f}`).toBe(c === f);
    }
  });
});

describe('contagens com os dados reais do mapa (1.610 itens)', () => {
  it('sem filtro = 1.610', () => { expect(conta('')).toBe(1610); });
  it('Pet = 181 (inalterado); Animal = animal + pet = 457', () => { expect(conta('pet')).toBe(181); expect(conta('animal')).toBe(276 + 181); });
  it('Celular = 18 (hoje); Eletrônico = electronics + phone = 147', () => { expect(conta('phone')).toBe(18); expect(conta('electronics')).toBe(129 + 18); });
  it('Outro = other + book + nulos = 186 + 2 + 3 = 191', () => { expect(conta('other')).toBe(186 + 2 + 2 + 1); });
  it('DEPOIS da migração dos 41 públicos do grupo A (electronics → phone): Celular = 59, Eletrônico continua 147, Pet/Animal/Outro iguais', () => {
    const depois = { ...MAPA, electronics: MAPA.electronics - 41, phone: MAPA.phone + 41 };
    const lista = Object.entries(depois).flatMap(([c, n]) => Array.from({ length: n }, () => c));
    expect(conta('phone', lista)).toBe(59);
    expect(conta('electronics', lista)).toBe(147);
    expect(conta('pet', lista)).toBe(181);
    expect(conta('animal', lista)).toBe(457);
    expect(conta('other', lista)).toBe(191);
    expect(conta('', lista)).toBe(1610);
  });
  it('cada item do mapa cai em pelo menos um filtro de categoria (nada some do filtro)', () => {
    for (const c of Object.keys(MAPA)) expect(OPCOES_FILTRO_CATEGORIA.some((o) => pertenceAoFiltro(c, o.valor)), c).toBe(true);
  });
});

describe('opções do filtro e rótulos', () => {
  it('13 opções, com «Animal» antes de «Pet»', () => {
    const rotulos = OPCOES_FILTRO_CATEGORIA.map((o) => o.rotulo);
    expect(rotulos).toHaveLength(13);
    expect(rotulos.indexOf('Animal')).toBeLessThan(rotulos.indexOf('Pet'));
    expect(rotulos).toEqual(expect.arrayContaining(['Celular', 'Eletrônico', 'Outro']));
  });
  it('rótulo exibido: animal = «Animal»; book/nula/desconhecida = «Outro»', () => {
    expect(rotuloDaCategoria('animal')).toBe('Animal');
    expect(rotuloDaCategoria('pet')).toBe('Pet');
    expect(rotuloDaCategoria('phone')).toBe('Celular');
    for (const c of ['book', null, 'found']) expect(rotuloDaCategoria(c as string)).toBe('Outro');
  });
});

describe('guardas de código: a hierarquia mora num lugar só e o mapa a usa', () => {
  const mapa = read('src/app/map/client.tsx');
  it('o mapa usa o mapa de categorias compartilhado, não compara mais a categoria à mão', () => {
    expect(mapa).toContain("from '@/lib/categorias'");
    expect(mapa).toContain('pertenceAoFiltro(o.category, filters.category)');
    expect(mapa).not.toMatch(/o\.category !== filters\.category/);
    expect(mapa).not.toContain('const CATEGORY_LABEL');
  });
  it('as relações pai/filha não são repetidas em nenhum outro arquivo do mapa', () => {
    expect(mapa).not.toMatch(/pet\s*:\s*'animal'|animal\s*:\s*\[/);
  });
  it('escopo: Feed, busca, listas públicas, matching e cadastro NÃO importam o mapa de categorias nesta etapa', () => {
    for (const f of ['src/lib/feed/category.ts', 'src/lib/matching.ts', 'src/lib/matchingFiltro.ts', 'src/lib/buscaDicionario.ts', 'src/app/api/v1/objects/public/route.ts', 'src/app/dashboard/objects/new/page.tsx']) {
      expect(read(f), f).not.toContain('@/lib/categorias');
    }
  });
});
