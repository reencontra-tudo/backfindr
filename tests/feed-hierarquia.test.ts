// Feed e /achei coerentes com a HIERARQUIA de categorias (decisão do fundador, 24/11/2026): Animal ⊃ Pet. O filtro «Pet» NÃO inclui «animal»; o filtro «Animal» inclui «pet».
// Escopo: só animal/pet no Feed. As demais categorias seguem exatamente como eram (o filtro «Eletrônico» continua mostrando só eletrônico). O legado continua fora do Feed (exceção F-01).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { FEED_CATEGORY_LABELS, feedCategoryKey, feedPertenceAoFiltro, isFeedCategoryKey } from '@/lib/feed/category';
import { cadastroHref, validarContexto } from '@/lib/feed/contexto';

const st = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, contexto: null as null | Record<string, unknown> }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('FROM municipalities')) return { rows: [] };
    if (sql.includes('SELECT o.title, o.category, o.type')) return { rows: st.contexto ? [st.contexto] : [] };
    return { rows: st.rows };
  }),
}));

import { getRankedFeed, resetFeedCache, FEED_ELIGIBILITY_WHERE } from '@/lib/feed/query';
import { GET as contextoGET } from '@/app/api/v1/feed/contexto/route';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const linha = (code: string, category: string | null, extra: Record<string, unknown> = {}) => ({
  code, title: `Ocorrência ${code}`, status: 'lost', category, type: category, location_text: 'Boa Viagem, Recife - PE', latitude: -8.1, longitude: -34.9, source: null,
  created_at: '2026-11-20T10:00:00Z', boosted: false, photo_url: null, source_url: null, ...extra,
});
const codigos = async (categoria: string | null) => (await getRankedFeed({ category: categoria })).items.map((i) => i.code).sort();

beforeEach(() => {
  resetFeedCache();
  st.rows = [linha('ANI1', 'animal'), linha('ANI2', 'animal'), linha('PET1', 'pet'), linha('PET2', 'pet'), linha('PHO1', 'phone'), linha('ELE1', 'electronics'), linha('OUT1', 'other'), linha('NUL1', null)];
  st.contexto = null;
});

describe('chaves e rótulos do Feed', () => {
  it('«animal» é uma categoria do Feed (13 no total), com rótulo «Animal»; «pet» segue «Pet»; as 12 de antes não mudam', () => {
    expect(isFeedCategoryKey('animal')).toBe(true);
    expect(Object.keys(FEED_CATEGORY_LABELS)).toHaveLength(13);
    expect(feedCategoryKey('animal')).toBe('animal');
    expect(feedCategoryKey('pet')).toBe('pet');
    expect(feedCategoryKey('phone')).toBe('phone');
    expect(feedCategoryKey('book')).toBe('other');
  });
  it('a regra: mãe inclui filha; filha nunca inclui a mãe; as outras categorias só elas mesmas', () => {
    expect(feedPertenceAoFiltro('pet', 'animal')).toBe(true);
    expect(feedPertenceAoFiltro('animal', 'animal')).toBe(true);
    expect(feedPertenceAoFiltro('animal', 'pet')).toBe(false); // um cavalo roubado não é pet
    expect(feedPertenceAoFiltro('pet', 'pet')).toBe(true);
    expect(feedPertenceAoFiltro('phone', 'electronics')).toBe(false); // no Feed, Eletrônico NÃO mudou (escopo: só animal/pet)
    expect(feedPertenceAoFiltro('electronics', 'electronics')).toBe(true);
    expect(feedPertenceAoFiltro('vehicle', 'animal')).toBe(false);
  });
});

describe('filtro de categoria do Feed (lista de verdade, banco simulado)', () => {
  it('Pet mostra SÓ pet: NUNCA animal', async () => { expect(await codigos('pet')).toEqual(['PET1', 'PET2']); });
  it('Animal mostra animal + pet', async () => { expect(await codigos('animal')).toEqual(['ANI1', 'ANI2', 'PET1', 'PET2']); });
  it('as demais categorias seguem como eram: Celular só celular; Eletrônico só eletrônico (não inclui celular); Outros inclui o sem categoria', async () => {
    expect(await codigos('phone')).toEqual(['PHO1']);
    expect(await codigos('electronics')).toEqual(['ELE1']);
    expect(await codigos('other')).toEqual(['NUL1', 'OUT1']);
  });
  it('sem filtro (ou «all»): todos os 8, nada some', async () => {
    expect(await codigos(null)).toHaveLength(8);
    expect(await codigos('all')).toHaveLength(8);
  });
  it('categoria que não existe: ignorada (lista inteira), como sempre', async () => { expect(await codigos('inexistente')).toHaveLength(8); });
  it('o cartão de um animal mostra a chave e o rótulo «Animal» (não «Pet»)', async () => {
    const f = await getRankedFeed({});
    const ani = f.items.find((i) => i.code === 'ANI1')!; const pet = f.items.find((i) => i.code === 'PET1')!;
    expect([ani.category, ani.category_label]).toEqual(['animal', 'Animal']);
    expect([pet.category, pet.category_label]).toEqual(['pet', 'Pet']);
  });
});

describe('/achei: contexto do cartão «Informar que encontrei»', () => {
  const chama = async () => (await contextoGET(new NextRequest('http://x/api/v1/feed/contexto?de=ABC123XY', { headers: { 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 200) } }))).json();
  it('animal perdido: categoria «animal», rótulo «Animal» (antes dizia «Pet»); pet: «pet», «Pet»', async () => {
    st.contexto = { title: 'Égua alazã perdida', category: 'animal', type: 'animal' };
    expect((await chama()).contexto).toMatchObject({ categoria: 'animal', categoria_rotulo: 'Animal', situacao: 'lost' });
    st.contexto = { title: 'Cachorro perdido', category: 'pet', type: 'pet' };
    expect((await chama()).contexto).toMatchObject({ categoria: 'pet', categoria_rotulo: 'Pet' });
  });
  it('o validador do contexto aceita «animal» e o link de cadastro leva a categoria certa', () => {
    const ctx = validarContexto({ contexto: { titulo: 'Égua perdida', categoria: 'animal', categoria_rotulo: 'x', situacao: 'lost' } });
    expect(ctx).toMatchObject({ categoria: 'animal', categoria_rotulo: 'Animal' });
    expect(cadastroHref(ctx!, 'ABC123XY')).toContain('prefill_category=animal');
    expect(cadastroHref({ titulo: 'Cão', categoria: 'pet' })).toContain('prefill_category=pet');
  });
  it('contexto de qualquer outra categoria não muda', () => {
    for (const c of ['phone', 'wallet', 'keys', 'vehicle', 'document']) expect(validarContexto({ contexto: { titulo: 't', categoria: c, categoria_rotulo: 'x', situacao: 'lost' } })!.categoria_rotulo).toBe(FEED_CATEGORY_LABELS[c as keyof typeof FEED_CATEGORY_LABELS]);
  });
});

describe('guardas', () => {
  it('o legado continua FORA do Feed (exceção F-01): a elegibilidade exige is_legacy = false', () => {
    expect(FEED_ELIGIBILITY_WHERE).toContain('is_legacy = false');
  });
  it('as opções do filtro do Feed vêm dos rótulos (a opção «Animal» aparece sozinha) e o ícone existe para toda chave', () => {
    const c = read('src/app/feed/FeedClient.tsx');
    expect(c).toContain('Object.keys(FEED_CATEGORY_LABELS)');
    expect(c).toContain('animal: Wheat');
  });
  it('o filtro do servidor usa a regra de hierarquia (e não a igualdade simples)', () => {
    expect(read('src/lib/feed/query.ts')).toContain('feedPertenceAoFiltro(r.category, cat)');
  });
  it('matching, busca, mapa e listas públicas NÃO foram tocados por este PR (grupo animal/pet do matching continua)', () => {
    const m = read('src/lib/matching.ts');
    expect(m).toContain("pet: ['pet', 'animal'],"); expect(m).toContain("animal: ['pet', 'animal'],");
    expect(read('src/lib/buscaDicionario.ts')).toContain("{ categorias: ['pet', 'animal'],");
  });
});
