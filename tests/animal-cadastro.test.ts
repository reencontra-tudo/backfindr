// Categoria «Animal» (criação/trabalho) no cadastro e a COERÊNCIA só para `animal` (decisão do fundador, 24/11/2026, MC-01, PR 2 Etapa 2).
// Duas famílias de teste: (1) a categoria nova faz o que deve em cada lugar; (2) NADA mudou para as demais categorias
// (as impressões digitais abaixo foram calculadas na `main` ANTES da mudança: se alguém alterar a configuração ou o cartaz de outra categoria, falham).
import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { CATEGORY_FIELDS, getAllFieldsForCategory } from '@/config/categoryFields';
import { buildPosterData } from '@/lib/posterFormatter';
import { faltasDoAnimal, resumirErros, PASSO_DETALHES } from '@/lib/formularioOcorrencia';
import { FEED_CATEGORY_LABELS, feedCardLabel, feedCategoryKey, feedCategoryLabel } from '@/lib/feed/category';
import { compactar, expandir, validarEstado } from '@/lib/feed/estado';
import { pertenceAoFiltro } from '@/lib/categorias';
import { expandCategoryGroup } from '@/lib/matching';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const h = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

// ───────────────────────────── 1. a categoria Animal ─────────────────────────────
describe('campos de Animal (config)', () => {
  const cfg = CATEGORY_FIELDS.animal;
  it('espécie e cor/pelagem são essenciais; o resto é opcional; nomes animal_* (não reaproveita pet_*)', () => {
    expect(cfg.essentialFields.map((f) => f.name)).toEqual(['animal_species', 'animal_color']);
    expect(cfg.essentialFields.every((f) => f.required)).toBe(true);
    expect(cfg.optionalFields.map((f) => f.name)).toEqual(['animal_breed', 'animal_sex', 'animal_age', 'animal_size', 'animal_marks', 'animal_id_tag']);
    expect(getAllFieldsForCategory('animal').every((f) => f.name.startsWith('animal_'))).toBe(true);
  });
  it('espécies de criação/trabalho (cavalo, boi, porco...) e NÃO as de estimação', () => {
    const vals = cfg.essentialFields[0].options!.map((o) => o.value);
    expect(vals).toEqual(expect.arrayContaining(['horse', 'cattle', 'pig']));
    expect(vals).not.toContain('dog');
    expect(vals).not.toContain('cat');
  });
});

describe('cadastro: espécie e cor/pelagem obrigatórias SÓ para animal', () => {
  it('animal sem espécie e sem cor → duas faltas; vai para o passo Detalhes com mensagens claras', () => {
    const f = faltasDoAnimal('animal', {});
    expect(Object.keys(f!).sort()).toEqual(['animal_color', 'animal_species']);
    const r = resumirErros(f!, 'report', false);
    expect(r.passo).toBe(PASSO_DETALHES);
    expect(r.mensagens).toEqual(['Falta a espécie do animal', 'Falta a cor ou pelagem do animal']);
  });
  it('animal com os dois preenchidos (ou só com espaços = vazio)', () => {
    expect(faltasDoAnimal('animal', { animal_species: 'horse', animal_color: 'alazão' })).toBeNull();
    expect(faltasDoAnimal('animal', { animal_species: 'horse', animal_color: '   ' })).toHaveProperty('animal_color');
  });
  it('QUALQUER outra categoria: nunca há falta (cadastro idêntico ao de hoje)', () => {
    for (const c of ['pet', 'phone', 'wallet', 'keys', 'bag', 'bike', 'vehicle', 'document', 'jewelry', 'electronics', 'clothing', 'other', undefined]) {
      expect(faltasDoAnimal(c, {}), String(c)).toBeNull();
    }
  });
});

describe('cartaz de animal', () => {
  const titulo = (status: string) => buildPosterData({ title: 'Égua alazã', category: 'animal', status }, 'https://x.test').headline;
  it('NUNCA «OBJETO ROUBADO»: «ANIMAL ROUBADO/PERDIDO/ENCONTRADO...»', () => {
    expect(titulo('stolen')).toBe('ANIMAL ROUBADO');
    expect(titulo('lost')).toBe('ANIMAL PERDIDO');
    expect(titulo('found')).toBe('ANIMAL ENCONTRADO');
    expect(titulo('returned')).toBe('ANIMAL DEVOLVIDO');
    for (const s of ['stolen', 'lost', 'found', 'returned', 'protected']) expect(titulo(s)).not.toMatch(/OBJETO/);
  });
  it('e o rótulo da categoria no cartaz é «Animal»', () => {
    expect(buildPosterData({ title: 'x', category: 'animal', status: 'lost' }, 'https://x.test').categoryLabel).toBe('Animal');
  });
});

describe('página do objeto e scan', () => {
  it('o bloco «Informações do animal» aparece para pet E animal (e o rótulo «Animal» existe na página do objeto)', () => {
    expect(read('src/app/objeto/[code]/client.tsx')).toContain("(obj.category === 'pet' || obj.category === 'animal') && (obj.pet_breed");
    expect(read('src/app/objeto/[code]/client.tsx')).toContain("animal: 'Animal'");
    expect(read('src/app/scan/[code]/client.tsx')).toContain("(obj.category === 'pet' || obj.category === 'animal') && (obj.pet_breed");
  });
});

describe('e-mails', () => {
  const email = read('src/lib/email.ts');
  it('animal NÃO é chamado de «pet»; pet continua «pet»', () => {
    expect(email).toContain("pet: 'pet', animal: 'animal',");
    expect(email).not.toContain("animal: 'pet'");
  });
});

describe('Feed: só o RÓTULO muda; chave, filtros e busca ficam como eram', () => {
  it('rótulo exibido: animal → «Animal»; os demais iguais ao de sempre', () => {
    expect(feedCategoryLabel('animal')).toBe('Animal');
    expect(feedCategoryLabel('ANIMAL ')).toBe('Animal');
    expect(feedCategoryLabel('pet')).toBe('Pet');
    for (const [k, rotulo] of Object.entries(FEED_CATEGORY_LABELS)) expect(feedCategoryLabel(k), k).toBe(rotulo);
    for (const sujo of ['found', 'lost', '', null, undefined, 'book']) expect(feedCategoryLabel(sujo as string)).toBe('Outros');
  });
  it('a CHAVE do Feed segue como era (animal → pet): filtros e busca do Feed não mudam', () => {
    expect(feedCategoryKey('animal')).toBe('pet');
    expect(Object.keys(FEED_CATEGORY_LABELS)).toHaveLength(12);
    expect(Object.keys(FEED_CATEGORY_LABELS)).not.toContain('animal'); // nenhuma opção nova nos filtros do Feed
  });
  it('cartão: «Animal» só quando o item é animal; qualquer outro rótulo inconsistente do item é IGNORADO (como sempre: vale a chave)', () => {
    expect(feedCardLabel('pet', 'Animal')).toBe('Animal');
    expect(feedCardLabel('pet', 'Pet')).toBe('Pet');
    expect(feedCardLabel('document', 'Celular')).toBe('Documento'); // rótulo do item errado não vence a chave
    expect(feedCardLabel('phone', 'Animal')).toBe('Celular');
    expect(feedCardLabel('pet', undefined)).toBe('Pet');
  });
  it('estado salvo do Feed: «Animal» sobrevive à volta da página; item comum salva exatamente como antes', () => {
    const base = { code: 'ABC', title: 't', status: 'lost' as const, status_label: 'Perdido', origin: 'usuario' as const, location_label: 'SP', photo_url: null, created_at: '2026-11-24T00:00:00Z', source_url: null, source_name: null, can_report_found: true, has_photo: false };
    const animal = { ...base, category: 'pet' as const, category_label: 'Animal' };
    const pet = { ...base, category: 'pet' as const, category_label: 'Pet' };
    expect(compactar(animal)).toHaveProperty('category_label', 'Animal');
    expect(expandir(compactar(animal)).category_label).toBe('Animal');
    expect(compactar(pet)).not.toHaveProperty('category_label'); // formato idêntico ao de antes
    expect(expandir(compactar(pet)).category_label).toBe('Pet');
    const estado = { v: 1, t: Date.now(), pagina: 1, itens: [compactar(animal)], cursor: null, temMais: false, filtros: { status: 'all', category: 'all', region: 'todas', geo: null }, marcos: [] };
    expect(typeof validarEstado).toBe('function'); expect(estado.itens[0].category_label).toBe('Animal');
  });
  it('o cartão do Feed mostra o rótulo do item; as buscas do Feed usam o rótulo só para exibir', () => {
    expect(read('src/app/feed/FeedClient.tsx')).toContain('{feedCardLabel(item.category, item.category_label)}');
    expect(read('src/lib/feed/query.ts')).toContain('category_label: feedCategoryLabel(');
    expect(read('src/lib/colaboradores/feed.ts')).toContain('category_label: feedCategoryLabel(');
  });
});

describe('cadastro: cartões Pet e Animal', () => {
  const pagina = read('src/app/dashboard/objects/new/page.tsx');
  it('cartão «Pet» (estimação) e cartão «Animal» (criação/trabalho), com texto de ajuda que evita confusão', () => {
    expect(pagina).toContain("{ value: 'pet', label: 'Pet', emoji: '🐾', hint: 'Animal de estimação: cachorro, gato, pássaro…' }");
    expect(pagina).toContain("{ value: 'animal', label: 'Animal', emoji: '🐴', hint: 'De criação ou trabalho: cavalo, boi, porco…' }");
    expect(pagina).not.toContain("label: 'Pet / Animal'");
  });
  it('os demais cartões continuam exatamente como eram (sem texto de ajuda)', () => {
    const lista = pagina.slice(pagina.indexOf('const CATEGORIES'), pagina.indexOf('];', pagina.indexOf('const CATEGORIES')));
    const linhas = lista.split('\n').filter((l) => l.includes("{ value: '"));
    expect(linhas).toHaveLength(12);
    for (const l of linhas.filter((x) => !/value: '(pet|animal)'/.test(x))) expect(l).not.toContain('hint');
    expect(lista).toContain("{ value: 'phone', label: 'Celular', emoji: '📱' }");
    expect(lista).toContain("{ value: 'other', label: 'Outro', emoji: '📦' }");
  });
  it('os campos animal_* vão no envio pelo auxiliar único de campos específicos (só os da categoria escolhida)', () => {
    expect(pagina).toContain('camposEspecificosParaEnvio(data.category');
  });
});

// ───────────────────── 2. nada mudou para as demais categorias ─────────────────────
describe('não regressão: demais categorias idênticas às da main', () => {
  const ESPERADO: Record<string, string> = {
    // Impressões digitais ATUALIZADAS em 24/11/2026 (PR A): a ÚNICA diferença para a main é a remoção da marcação «obrigatório» (24 linhas `required: true`, conferido por git diff).
    vehicle: '40561cd20ec2f5d2', phone: '019908949b8a7b4f', electronics: '7a5d2f70fe00a90c', pet: '3d9d286a2280c0a2',
    wallet: '5f4700fbd230adf4', document: '8ef60e5f1db701dd', keys: 'b3a107fabf9d5b22', bike: '22d5c6c978e1b7dc',
  };
  it('campos específicos das 8 categorias existentes: idênticos (impressão digital da main)', () => {
    for (const [c, esperado] of Object.entries(ESPERADO)) expect(h(CATEGORY_FIELDS[c]), c).toBe(esperado);
    expect(Object.keys(CATEGORY_FIELDS).sort()).toEqual([...Object.keys(ESPERADO), 'animal'].sort());
  });
  it('títulos do cartaz das demais categorias (15 categorias × 5 situações, incl. desconhecida): idênticos', () => {
    const cats = ['pet', 'phone', 'wallet', 'keys', 'bag', 'bike', 'vehicle', 'document', 'jewelry', 'electronics', 'clothing', 'other', 'dog', 'cat', 'zzz'];
    const sts = ['lost', 'found', 'stolen', 'returned', 'protected'];
    const t: Record<string, string> = {};
    for (const c of cats) for (const s of sts) t[`${c}/${s}`] = buildPosterData({ title: 'Teste', description: 'd', category: c, status: s, created_at: '2026-01-01T00:00:00Z', qr_code: 'ABC' }, 'https://x.test').headline;
    expect(h(t)).toBe('ac977ff1c1601f00');
  });
  it('Feed: rótulos das 12 categorias do Feed inalterados', () => {
    expect(h(FEED_CATEGORY_LABELS)).toBe(h({ pet: 'Pet', document: 'Documento', phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa ou mochila', bike: 'Bicicleta', vehicle: 'Veículo', jewelry: 'Joia', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outros' }));
  });
});

describe('escopo: o que NÃO pode mudar', () => {
  it('Pet NUNCA mostra «animal» no filtro do mapa (hierarquia)', () => {
    expect(pertenceAoFiltro('animal', 'pet')).toBe(false);
    expect(pertenceAoFiltro('pet', 'animal')).toBe(true);
  });
  it('matching MANTIDO: Animal compara com Animal e Pet (grupo de equivalência atual), e Pet também', () => {
    expect(expandCategoryGroup('animal').sort()).toEqual(['animal', 'pet']);
    expect(expandCategoryGroup('pet').sort()).toEqual(['animal', 'pet']);
    expect(expandCategoryGroup('phone')).toEqual(['phone']);
    const m = read('src/lib/matching.ts');
    expect(m).toContain("pet: ['pet', 'animal'],");
    expect(m).toContain("animal: ['pet', 'animal'],");
  });
  it('SEO: o que soma animal em pet continua como está (pendência registrada, NÃO mexer agora)', () => {
    expect(read('src/app/api/v1/admin/municipalities/refresh-stats/route.ts')).toContain("WHEN o.category IN ('pet', 'animal') THEN 'pet'");
  });
  it('categoria nova no tipo do produto e na edição', () => {
    expect(read('src/types/index.ts')).toContain("'pet'|'animal'|'bike'");
    expect(read('src/app/dashboard/objects/[id]/edit/page.tsx')).toContain("{ value: 'animal',");
  });
});
