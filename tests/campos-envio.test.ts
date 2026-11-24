// PR A (24/11/2026): TODOS os campos específicos que o cadastro EXIBE agora são ENVIADOS (e guardados em `category_fields`).
// Histórico: desde 20/05/2026 o formulário mostrava marca, modelo, IMEI, placa etc. mas o envio os descartava (nenhum teste comparava o que se mostra com o que se envia).
// Este arquivo é a PROTEÇÃO contra essa perda voltar: se alguém acrescentar um campo na configuração e o envio não o levar, ou trocar o auxiliar, estes testes falham.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { CATEGORY_FIELDS, getAllFieldsForCategory, type FieldDefinition } from '@/config/categoryFields';
import { camposEspecificosParaEnvio, faltasDoAnimal } from '@/lib/formularioOcorrencia';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const amostra = (f: FieldDefinition): string | number => (f.type === 'number' ? 2020 : f.type === 'select' ? f.options![0].value : `teste-${f.name}`);
const CATEGORIAS_COM_CAMPOS = Object.keys(CATEGORY_FIELDS);

describe('cada campo exibido é enviado', () => {
  for (const cat of CATEGORIAS_COM_CAMPOS.filter((c) => c !== 'document')) {
    it(`${cat}: TODOS os ${getAllFieldsForCategory(cat).length} campos configurados vão no corpo`, () => {
      const valores: Record<string, unknown> = {};
      for (const f of getAllFieldsForCategory(cat)) valores[f.name] = amostra(f);
      const enviado = camposEspecificosParaEnvio(cat, valores);
      expect(Object.keys(enviado).sort()).toEqual(getAllFieldsForCategory(cat).map((f) => f.name).sort());
      for (const f of getAllFieldsForCategory(cat)) expect(enviado[f.name], f.name).toBe(amostra(f));
    });
  }
  it('as 6 categorias do relatório (celular, eletrônico, veículo, carteira, chaves, bicicleta) + pet + animal estão cobertas', () => {
    for (const c of ['phone', 'electronics', 'vehicle', 'wallet', 'keys', 'bike', 'pet', 'animal']) expect(CATEGORIAS_COM_CAMPOS).toContain(c);
  });
  it('pet: os 4 campos que se perdiam (tamanho, idade, marcas e sinais, coleira) agora vão', () => {
    const e = camposEspecificosParaEnvio('pet', { pet_size: 'small', pet_age: '3 anos', pet_distinguishing_marks: 'mancha', pet_collar_description: 'azul', pet_species: 'dog' });
    expect(e).toEqual({ pet_size: 'small', pet_age: '3 anos', pet_distinguishing_marks: 'mancha', pet_collar_description: 'azul', pet_species: 'dog' });
  });
  it('identificadores (IMEI, série, placa, chassi) também vão: são guardados; QUEM os vê é decisão do PR B', () => {
    const e = camposEspecificosParaEnvio('phone', { phone_imei: '123456789012345', phone_serial: 'ABC' });
    expect(e).toEqual({ phone_imei: '123456789012345', phone_serial: 'ABC' });
    expect(camposEspecificosParaEnvio('vehicle', { vehicle_plate: 'ABC1D23', vehicle_vin: '9BW' })).toEqual({ vehicle_plate: 'ABC1D23', vehicle_vin: '9BW' });
  });
});

describe('o que NÃO vai (corpo idêntico ao de hoje no resto)', () => {
  it('vazio, só espaços, nulo e indefinido NÃO são enviados (como sempre)', () => {
    expect(camposEspecificosParaEnvio('phone', { phone_brand: '', phone_model: '   ', phone_color: null, phone_imei: undefined })).toEqual({});
  });
  it('texto é aparado; número válido vai; número inválido não', () => {
    expect(camposEspecificosParaEnvio('vehicle', { vehicle_brand: '  Fiat ', vehicle_year: 2019 })).toEqual({ vehicle_brand: 'Fiat', vehicle_year: 2019 });
    expect(camposEspecificosParaEnvio('vehicle', { vehicle_year: Number.NaN })).toEqual({});
  });
  it('só os campos da categoria escolhida (valores de outra categoria que sobraram no formulário NÃO vão)', () => {
    expect(camposEspecificosParaEnvio('phone', { phone_brand: 'Apple', vehicle_plate: 'ABC1D23', pet_species: 'dog' })).toEqual({ phone_brand: 'Apple' });
  });
  it('documento, bolsa, joia, roupa, outro e categoria desconhecida: nada (o documento tem envio próprio)', () => {
    for (const c of ['document', 'bag', 'jewelry', 'clothing', 'other', 'zzz', undefined]) expect(camposEspecificosParaEnvio(c, { document_type: 'rg', pet_species: 'dog' }), String(c)).toEqual({});
  });
});

describe('nenhum campo novo é exigido: nada barra um cadastro que hoje passa', () => {
  it('marcação «obrigatório» só no Animal (espécie e cor/pelagem); nenhuma outra categoria tem campo obrigatório', () => {
    for (const [cat, cfg] of Object.entries(CATEGORY_FIELDS)) {
      const obrig = [...cfg.essentialFields, ...cfg.optionalFields].filter((f) => f.required).map((f) => f.name);
      expect(obrig, cat).toEqual(cat === 'animal' ? ['animal_species', 'animal_color'] : []);
    }
  });
  it('o formulário só barra por falta de campo no Animal', () => {
    for (const c of CATEGORIAS_COM_CAMPOS.filter((x) => x !== 'animal')) expect(faltasDoAnimal(c, {}), c).toBeNull();
    expect(faltasDoAnimal('animal', {})).not.toBeNull();
  });
});

describe('guardas do código do cadastro', () => {
  const pagina = read('src/app/dashboard/objects/new/page.tsx');
  it('o envio usa o auxiliar único e NÃO tem mais envio à mão de pet_* (a causa da perda)', () => {
    expect(pagina).toContain('Object.assign(payload, camposEspecificosParaEnvio(data.category, getValues() as Record<string, unknown>));');
    expect(pagina).not.toContain('payload.pet_species');
    expect(pagina).not.toContain("if (data.pet_species)");
  });
  it('a duplicação dos campos de pet saiu: só o bloco dinâmico, sem o bloco antigo «Informações do Pet»', () => {
    expect(pagina).not.toContain('Informações do Pet');
    expect(pagina).not.toContain("register('pet_species')");
    expect(pagina).toContain('<DynamicCategoryFields');
  });
  it('os campos dinâmicos continuam aparecendo para toda categoria com configuração (menos outro e bolsa, como hoje)', () => {
    expect(pagina).toContain("category && !['other', 'bag'].includes(category) &&");
  });
  it('documento continua com envio próprio (regras de privacidade F-27/F-28 intactas)', () => {
    expect(pagina).toContain("if (data.category === 'document') {");
    expect(pagina).toContain('document_owner_name');
  });
  it('o servidor NÃO mudou: continua guardando o resto do corpo em category_fields', () => {
    const rota = read('src/app/api/v1/objects/route.ts');
    expect(rota).toContain('...categoryFields } = body;');
    expect(rota).toContain('JSON.stringify(categoryFields)');
  });
});
