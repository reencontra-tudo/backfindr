// PR B (24/11/2026): EXIBIR os campos específicos das categorias (páginas do objeto e do scan, painel do titular) e EDITÁ-LOS (titular), com a regra de privacidade.
//   SENSÍVEIS (só o titular): IMEI, número de série, chassi, microchip, brinco/registro, conteúdo da carteira (+ número do motor, a confirmar).
//   PÚBLICOS: demais campos não sensíveis e a PLACA do veículo ROUBADO.
// Banco simulado: o que se confere é o que cada rota devolve e grava.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { CATEGORY_FIELDS, getAllFieldsForCategory } from '@/config/categoryFields';
import { CAMPOS_SENSIVEIS, camposAlterados, camposParaExibir, campoEhPublico, validarEdicaoDeCampos, valoresBrutosDoTitular } from '@/lib/camposEspecificos';

const st = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, updates: [] as Array<{ sql: string; params: unknown[] }> }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/^\s*UPDATE objects/i.test(sql)) { st.updates.push({ sql, params }); if (sql.includes('RETURNING category_fields')) return { rows: [{ category_fields: { ...(st.row?.category_fields as object), ...JSON.parse(String(params[1])) } }] }; return { rows: st.row ? [st.row] : [] }; }
    if (sql.includes('FROM objects') && sql.includes('WHERE')) return { rows: st.row ? [st.row] : [] };
    return { rows: [] };
  }),
}));
vi.mock('@/lib/pushNotification', () => ({ sendPushToUser: vi.fn(async () => undefined), scanPayload: vi.fn(() => ({})) }));
vi.mock('@/lib/email', () => ({ sendObjectFoundEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/events', () => ({ Events: { qrScanned: vi.fn(async () => undefined), statusChanged: vi.fn(async () => undefined), objectReturned: vi.fn(async () => undefined) }, recordEvent: vi.fn(async () => undefined) }));
vi.mock('@/lib/awaitSends', () => ({ awaitSends: vi.fn(async () => undefined) }));
vi.mock('@/lib/jwt', () => ({ verifyToken: () => ({ sub: 'u1' }), extractTokenFromHeader: () => 'tok', createAccessToken: () => 'x' }));

import { GET as scanGET } from '@/app/api/v1/objects/scan/[code]/route';
import { GET as idGET, PATCH as idPATCH } from '@/app/api/v1/objects/[id]/route';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const linha = (o: Record<string, unknown>) => ({ id: 'o1', title: 'Teste', description: 'd', status: 'stolen', category: 'phone', type: 'phone', location: null, latitude: null, longitude: null, qr_code: 'QR1', images: [], color: null, brand: null, breed: null, is_legacy: false, source: null, user_id: 'u1',
  reward_amount: null, reward_description: null, created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z', subject_name: null, document_last4: null, legacy_blocked: false, category_fields: {}, campos_brutos: {}, ...o });
beforeEach(() => { st.row = null; st.updates = []; });

// ───────────────── 1. a regra de privacidade, campo a campo ─────────────────
describe('lista final: público × sensível, campo a campo', () => {
  const SENSIVEIS = ['phone_imei', 'phone_serial', 'electronics_imei', 'electronics_serial', 'vehicle_vin', 'vehicle_engine', 'bike_serial', 'pet_microchip', 'animal_id_tag', 'wallet_contents'];
  it('os sensíveis são EXATAMENTE os decididos pelo fundador (IMEI, série, chassi, microchip, brinco/registro, conteúdo da carteira) + número do motor', () => {
    expect([...CAMPOS_SENSIVEIS].sort()).toEqual([...SENSIVEIS].sort());
  });
  it('todo campo sensível existe na configuração (nenhum nome errado)', () => {
    const todos = new Set(Object.values(CATEGORY_FIELDS).flatMap((c) => getAllFieldsForCategory(c.category).map((f) => f.name)));
    for (const s of SENSIVEIS) expect(todos.has(s), s).toBe(true);
  });
  for (const [cat, cfg] of Object.entries(CATEGORY_FIELDS)) {
    if (cat === 'document') continue;
    it(`${cat}: página pública mostra só os não sensíveis (placa só se roubado); titular vê todos`, () => {
      const cf: Record<string, unknown> = {};
      for (const f of getAllFieldsForCategory(cfg.category)) cf[f.name] = f.type === 'select' ? f.options![0].value : f.type === 'number' ? 2020 : `v-${f.name}`;
      const publico = camposParaExibir(cat, cf, { publico: true, status: 'lost' }).map((c) => c.chave);
      const stolen = camposParaExibir(cat, cf, { publico: true, status: 'stolen' }).map((c) => c.chave);
      const titular = camposParaExibir(cat, cf, { publico: false }).map((c) => c.chave);
      const todos = getAllFieldsForCategory(cfg.category).map((f) => f.name);
      expect(titular).toEqual(todos);
      for (const k of publico) expect(SENSIVEIS.includes(k) || k === 'vehicle_plate', k).toBe(false);
      for (const k of stolen) expect(SENSIVEIS.includes(k), k).toBe(false);
      expect(stolen.includes('vehicle_plate')).toBe(cat === 'vehicle');
      expect(publico.includes('vehicle_plate')).toBe(false);
      expect(publico).toEqual(todos.filter((n) => !SENSIVEIS.includes(n) && n !== 'vehicle_plate'));
    });
  }
  it('placa de veículo: pública só quando ROUBADO; perdido, encontrado e protegido: só o titular', () => {
    const cf = { vehicle_plate: 'ABC1D23', vehicle_brand: 'Fiat', vehicle_vin: '9BWZZZ' };
    for (const s of ['lost', 'found', 'protected', 'returned']) expect(camposParaExibir('vehicle', cf, { publico: true, status: s }).map((c) => c.chave), s).toEqual(['vehicle_brand']);
    expect(camposParaExibir('vehicle', cf, { publico: true, status: 'stolen' }).map((c) => c.chave).sort()).toEqual(['vehicle_brand', 'vehicle_plate']);
    expect(campoEhPublico('vehicle_plate', 'stolen')).toBe(true); expect(campoEhPublico('vehicle_plate', 'lost')).toBe(false);
  });
});

describe('rótulos e valores em português (nada de «Pet Species» nem «dog»)', () => {
  it('pet: espécie «Cachorro», rótulos da configuração', () => {
    const c = camposParaExibir('pet', { pet_species: 'dog', pet_breed: 'SRD', pet_size: 'small', pet_color: 'Caramelo' }, { publico: true, status: 'lost' });
    expect(c.map((x) => [x.rotulo, x.valor])).toEqual(expect.arrayContaining([['Espécie', 'Cachorro'], ['Raça', 'SRD'], ['Cor / Padrão', 'Caramelo']]));
    for (const x of c) { expect(x.rotulo).not.toMatch(/_|Pet Species/); expect(x.valor).not.toBe('dog'); }
    expect(c.find((x) => x.chave === 'pet_size')!.valor).toMatch(/Pequeno/);
  });
  it('animal: «Cavalo / égua»; chaves desconhecidas (latitude, longitude, document_last4, qualquer outra) NUNCA saem', () => {
    const c = camposParaExibir('animal', { animal_species: 'horse', animal_color: 'alazão', latitude: -23, longitude: -46, document_last4: '1234', foo: 'bar' }, { publico: true });
    expect(c.map((x) => x.valor)).toEqual(['Cavalo / égua', 'alazão']);
  });
  it('vazio e espaços não aparecem; documento e categorias sem campos: lista vazia (o documento tem regras próprias)', () => {
    expect(camposParaExibir('phone', { phone_brand: '  ', phone_model: '' }, { publico: true })).toEqual([]);
    for (const cat of ['document', 'bag', 'jewelry', 'other', 'zzz', null]) expect(camposParaExibir(cat as string, { document_type: 'rg', anything: 1 }, { publico: true }), String(cat)).toEqual([]);
  });
});

// ───────────────── 2. rota pública (página do objeto e do scan) ─────────────────
describe('GET /api/v1/objects/scan/[code] (público)', () => {
  const chama = async () => (await (await scanGET(new NextRequest('http://x/api/v1/objects/scan/QR1'), { params: { code: 'QR1' } })).json());
  it('celular: marca, modelo e cor públicos; IMEI, série e armazenamento… sensíveis NÃO saem', async () => {
    st.row = linha({ category: 'phone', status: 'lost', campos_brutos: { phone_brand: 'Apple', phone_model: 'iPhone 15', phone_color: 'Preto', phone_imei: '123456789012345', phone_serial: 'SERIE-SECRETA', phone_storage: '128 GB', latitude: -23.5 } });
    const r = await chama(); const corpo = JSON.stringify(r);
    expect(r.campos_publicos.map((c: { chave: string }) => c.chave)).toEqual(['phone_brand', 'phone_model', 'phone_color', 'phone_storage']);
    expect(corpo).not.toContain('123456789012345'); expect(corpo).not.toContain('SERIE-SECRETA'); expect(corpo).not.toContain('phone_imei'); expect(corpo).not.toContain('sensivel');
  });
  it('veículo ROUBADO mostra a placa (e não o chassi nem o motor); veículo PERDIDO não mostra a placa', async () => {
    st.row = linha({ category: 'vehicle', status: 'stolen', campos_brutos: { vehicle_plate: 'ABC1D23', vehicle_vin: '9BWSECRETO', vehicle_engine: 'MOTORSECRETO', vehicle_brand: 'VW' } });
    let r = await chama(); let corpo = JSON.stringify(r);
    expect(corpo).toContain('ABC1D23'); expect(corpo).not.toContain('9BWSECRETO'); expect(corpo).not.toContain('MOTORSECRETO');
    st.row = linha({ category: 'vehicle', status: 'lost', campos_brutos: { vehicle_plate: 'ABC1D23', vehicle_brand: 'VW' } });
    corpo = JSON.stringify(await chama()); expect(corpo).not.toContain('ABC1D23'); expect(corpo).toContain('VW');
  });
  it('pet: microchip NUNCA sai; animal: brinco/registro NUNCA sai; conteúdo da carteira NUNCA sai', async () => {
    st.row = linha({ category: 'pet', status: 'lost', campos_brutos: { pet_species: 'cat', pet_microchip: '985141002876543' } });
    expect(JSON.stringify(await chama())).not.toContain('985141002876543');
    st.row = linha({ category: 'animal', status: 'stolen', campos_brutos: { animal_species: 'cattle', animal_id_tag: 'BRINCO-9999' } });
    const r = await chama(); expect(JSON.stringify(r)).not.toContain('BRINCO-9999'); expect(r.campos_publicos[0].valor).toBe('Boi / vaca / bezerro');
    st.row = linha({ category: 'wallet', status: 'lost', campos_brutos: { wallet_type: 'leather', wallet_contents: 'CPF 123 e cartão' } });
    const c = JSON.stringify(await chama()); expect(c).not.toContain('CPF 123'); expect(c).toContain('Couro');
  });
  it('legado, sinal público e objeto sem campos: a resposta é IDÊNTICA à de antes (a chave campos_publicos nem existe)', async () => {
    for (const extra of [{ is_legacy: true }, { source: 'public_signal' }, { legacy_blocked: true }, {}]) {
      st.row = linha({ category: 'phone', campos_brutos: extra && Object.keys(extra).length ? { phone_brand: 'Apple' } : {}, ...extra });
      const r = await chama(); expect(r, JSON.stringify(extra)).not.toHaveProperty('campos_publicos');
    }
  });
  it('a resposta não devolve `category_fields`, `campos_brutos` nem `campos_especificos` (privado)', async () => {
    st.row = linha({ category: 'phone', campos_brutos: { phone_brand: 'Apple', phone_imei: '1' } });
    const r = await chama(); for (const k of ['category_fields', 'campos_brutos', 'campos_especificos']) expect(r).not.toHaveProperty(k);
  });
});

// ───────────────── 3. rota do titular + edição ─────────────────
describe('GET /objects/[id] (titular) e PATCH (edição)', () => {
  const req = (corpo?: unknown, metodo = 'PATCH') => new NextRequest('http://x/api/v1/objects/o1', { method: metodo, headers: { 'content-type': 'application/json', authorization: 'Bearer tok' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  it('o titular recebe TODOS os campos (inclusive sensíveis) em `campos_especificos`; sem campos, a chave não existe', async () => {
    st.row = linha({ category: 'phone', category_fields: { phone_brand: 'Apple', phone_imei: '123', latitude: -23, outro: 'x' } });
    const r = await (await idGET(req(undefined, 'GET'), { params: { id: 'o1' } })).json();
    expect(r.campos_especificos).toEqual({ phone_brand: 'Apple', phone_imei: '123' });
    st.row = linha({ category: 'phone', category_fields: { latitude: -23 } });
    expect((await (await idGET(req(undefined, 'GET'), { params: { id: 'o1' } })).json())).not.toHaveProperty('campos_especificos');
  });
  it('PATCH com campos: grava só nomes da configuração, aparados; remove vazios; descarta o resto', async () => {
    st.row = linha({ category: 'phone', category_fields: { phone_brand: 'Apple' } });
    const r = await idPATCH(req({ campos_especificos: { phone_model: '  iPhone 15 ', phone_imei: '', hack: 'x', latitude: 1 } }), { params: { id: 'o1' } });
    expect(r.status).toBe(200);
    const up = st.updates.find((u) => u.sql.includes('category_fields = (COALESCE'))!;
    expect(up.params[0]).toEqual(['phone_imei', 'phone_model']); expect(JSON.parse(String(up.params[1]))).toEqual({ phone_model: 'iPhone 15' });
    expect(up.sql).toContain("is_legacy IS NOT TRUE"); expect(up.sql).toContain("source IS DISTINCT FROM 'public_signal'");
  });
  it('PATCH SEM campos_especificos: NENHUMA atualização de category_fields (pedido idêntico ao de antes)', async () => {
    st.row = linha({ category: 'phone', category_fields: { phone_brand: 'Apple' } });
    await idPATCH(req({ title: 'Novo título' }), { params: { id: 'o1' } });
    expect(st.updates.some((u) => u.sql.includes('category_fields = (COALESCE'))).toBe(false);
  });
  it('legado e sinal público: edição de campos é ignorada', async () => {
    for (const extra of [{ is_legacy: true }, { source: 'public_signal' }]) {
      st.updates = []; st.row = linha({ category: 'phone', ...extra });
      await idPATCH(req({ campos_especificos: { phone_brand: 'X' } }), { params: { id: 'o1' } });
      expect(st.updates.some((u) => u.sql.includes('category_fields = (COALESCE')), JSON.stringify(extra)).toBe(false);
    }
  });
});

describe('validação da edição', () => {
  it('só nomes da categoria; limite de tamanho; select só com opção válida; número inteiro; vazio remove', () => {
    const v = validarEdicaoDeCampos('vehicle', { vehicle_brand: ' Fiat ', vehicle_year: '2019', vehicle_type: 'car', vehicle_plate: '', vehicle_model: 'x'.repeat(500), pet_species: 'dog', latitude: 1 });
    expect(v.gravar.vehicle_brand).toBe('Fiat'); expect(v.gravar.vehicle_year).toBe(2019); expect(v.gravar.vehicle_type).toBe('car');
    expect(String(v.gravar.vehicle_model).length).toBeLessThanOrEqual(300); expect(v.remover).toEqual(['vehicle_plate']);
    expect(v.gravar).not.toHaveProperty('pet_species'); expect(v.gravar).not.toHaveProperty('latitude');
    expect(validarEdicaoDeCampos('vehicle', { vehicle_type: 'nave-espacial' }).gravar).toEqual({});
    expect(validarEdicaoDeCampos('vehicle', { vehicle_year: 'abc' }).gravar).toEqual({});
  });
  it('documento, categoria sem campos e corpo inválido: nada', () => {
    for (const c of ['document', 'bag', 'other', undefined]) expect(validarEdicaoDeCampos(c, { document_type: 'rg', x: 1 }), String(c)).toEqual({ gravar: {}, remover: [] });
    for (const corpo of [null, 'texto', 5, [1, 2], undefined]) expect(validarEdicaoDeCampos('phone', corpo)).toEqual({ gravar: {}, remover: [] });
  });
  it('camposAlterados: só o que mudou; nada mudou → undefined (corpo idêntico)', () => {
    expect(camposAlterados('phone', { phone_brand: 'Apple' }, { phone_brand: 'Apple' })).toBeUndefined();
    expect(camposAlterados('phone', { phone_brand: 'Apple ', phone_model: 'X' }, { phone_brand: 'Apple' })).toEqual({ phone_model: 'X' });
    expect(camposAlterados('phone', { phone_brand: '' }, { phone_brand: 'Apple' })).toEqual({ phone_brand: '' });
    expect(camposAlterados('document', { a: 1 }, {})).toBeUndefined();
    expect(valoresBrutosDoTitular('phone', { phone_brand: 'Apple', latitude: 1, x: 'y' })).toEqual({ phone_brand: 'Apple' });
  });
});

// ───────────────── 4. guardas: os sensíveis não vazam por nenhum outro caminho ─────────────────
describe('guardas de código', () => {
  const lista = (dir: string): string[] => readdirSync(path.join(__dirname, '..', dir)).flatMap((n) => { const rel = `${dir}/${n}`; return statSync(path.join(__dirname, '..', rel)).isDirectory() ? lista(rel) : [rel]; });
  it('`category_fields` só é lido pelas rotas do titular/criação/documento e pelo scan (que filtra): cartaz, Feed, busca, SEO, mapa, e-mail e matching NÃO o leem', () => {
    const permitidos = new Set(['src/app/api/v1/objects/route.ts', 'src/app/api/v1/objects/[id]/route.ts', 'src/app/api/v1/objects/scan/[code]/route.ts', 'src/app/api/v1/admin/public-signals/route.ts',
      'src/app/api/v1/admin/classify-legacy-persons/route.ts', 'src/app/dashboard/objects/new/page.tsx', 'src/types/index.ts', 'src/lib/documentPrivacy.ts', 'src/lib/camposEspecificos.ts', 'src/lib/formularioOcorrencia.ts']);
    const lidores = lista('src').filter((f) => /\.(ts|tsx)$/.test(f) && read(f).includes('category_fields')).filter((f) => !permitidos.has(f));
    expect(lidores).toEqual([]);
  });
  it('só a rota do scan, o painel/edição do titular e o componente de campos (aviso) importam o módulo de exibição; cartaz, Feed, e-mail, SEO e JSON-LD NÃO', () => {
    const importam = lista('src').filter((f) => /\.(ts|tsx)$/.test(f) && read(f).includes('@/lib/camposEspecificos')).sort();
    expect(importam).toEqual(['src/app/api/v1/objects/[id]/route.ts', 'src/app/api/v1/objects/scan/[code]/route.ts', 'src/app/dashboard/objects/[id]/edit/page.tsx', 'src/app/dashboard/objects/[id]/page.tsx', 'src/components/ui/DynamicCategoryFields.tsx'].sort());
  });
  it('o scan usa a lista PÚBLICA (publico: true) e remove a marca de sensível da resposta', () => {
    const r = read('src/app/api/v1/objects/scan/[code]/route.ts');
    expect(r).toContain('{ publico: true, status: row.status as string }');
    expect(r).toContain('camposPublicos.map(({ chave, rotulo, valor }) => ({ chave, rotulo, valor }))');
  });
  it('as páginas públicas só desenham `campos_publicos`; o painel do titular usa a visão do titular (publico: false) com o aviso «só você vê»', () => {
    for (const f of ['src/app/objeto/[code]/client.tsx', 'src/app/scan/[code]/client.tsx']) { const s = read(f); expect(s).toContain('obj.campos_publicos'); expect(s).not.toContain('campos_especificos'); }
    const painel = read('src/app/dashboard/objects/[id]/page.tsx');
    expect(painel).toContain('{ publico: false }'); expect(painel).toContain('só você vê');
  });
  it('a edição mostra os campos para toda categoria com configuração (menos documento) e só envia o que mudou', () => {
    const e = read('src/app/dashboard/objects/[id]/edit/page.tsx');
    expect(e).toContain("category !== 'document' && getCategoryFieldConfig(category)");
    expect(e).toContain('camposAlterados(category, espec, especOriginal)');
  });
  it('JSON-LD da página do objeto continua sem campos específicos', () => {
    expect(read('src/app/objeto/[code]/page.tsx')).not.toMatch(/campos_publicos|campos_especificos|imei|serial/i);
  });
});

// ───────────────── 5. aviso nos campos de texto livre públicos (cadastro e edição) ─────────────────
import React, { createElement } from 'react';
(globalThis as unknown as { React: typeof React }).React = React; // o componente usa JSX sem importar React (execução de teste)
import { renderToStaticMarkup } from 'react-dom/server';
import { DynamicCategoryFields } from '@/components/ui/DynamicCategoryFields';
import { AVISO_TEXTO_PUBLICO, CAMPOS_TEXTO_LIVRE_PUBLICO } from '@/lib/camposEspecificos';

describe('aviso «este texto é público» nos campos de texto livre públicos', () => {
  it('o texto do aviso é exatamente o decidido pelo fundador', () => {
    expect(AVISO_TEXTO_PUBLICO).toBe('Este texto é público. Não escreva aqui IMEI, número de série, chassi, documentos ou dados pessoais — eles têm campo próprio protegido.');
  });
  it('a lista são os campos de texto livre PÚBLICOS: textarea ou texto, nunca um campo sensível, e todos existem na configuração', () => {
    const todos = new Map(Object.values(CATEGORY_FIELDS).flatMap((c) => getAllFieldsForCategory(c.category).map((f) => [f.name, f] as const)));
    for (const n of CAMPOS_TEXTO_LIVRE_PUBLICO) { expect(todos.has(n), n).toBe(true); expect(CAMPOS_SENSIVEIS.has(n), n).toBe(false); expect(['text', 'textarea']).toContain(todos.get(n)!.type); }
    expect([...CAMPOS_TEXTO_LIVRE_PUBLICO].sort()).toEqual(['animal_marks', 'bike_distinguishing_marks', 'electronics_specs', 'keys_description', 'keys_distinguishing_marks', 'pet_collar_description', 'pet_distinguishing_marks', 'wallet_distinguishing_marks']);
  });
  it('toda textarea pública da configuração tem o aviso (nenhum campo de texto livre público fica sem ele); o conteúdo da carteira (sensível) não leva', () => {
    for (const cfg of Object.values(CATEGORY_FIELDS)) for (const f of getAllFieldsForCategory(cfg.category)) {
      if (f.type === 'textarea' && !CAMPOS_SENSIVEIS.has(f.name)) expect(CAMPOS_TEXTO_LIVRE_PUBLICO.has(f.name), f.name).toBe(true);
    }
    expect(CAMPOS_TEXTO_LIVRE_PUBLICO.has('wallet_contents')).toBe(false);
  });
  it('o componente (usado no CADASTRO e na EDIÇÃO) mostra o aviso uma vez por campo de texto livre público, e em nenhum outro', () => {
    // campos principais (visíveis sem abrir «detalhes adicionais»): chaves tem keys_description; os opcionais são conferidos pela regra acima
    const html = renderToStaticMarkup(createElement(DynamicCategoryFields, { category: 'keys', values: {}, onChange: () => {} }));
    expect((html.match(/data-aviso-texto-publico/g) ?? []).length).toBe(1);
    expect(html).toContain('Este texto é público.');
    for (const cat of ['phone', 'vehicle', 'document']) {
      const h = renderToStaticMarkup(createElement(DynamicCategoryFields, { category: cat, values: {}, onChange: () => {} }));
      expect(h, cat).not.toContain('data-aviso-texto-publico');
    }
  });
  it('cadastro e edição usam o MESMO componente (mesmo aviso nos dois)', () => {
    expect(read('src/app/dashboard/objects/new/page.tsx')).toContain('<DynamicCategoryFields');
    expect(read('src/app/dashboard/objects/[id]/edit/page.tsx')).toContain('<DynamicCategoryFields');
    expect(read('src/components/ui/DynamicCategoryFields.tsx')).toContain('AVISO_TEXTO_PUBLICO');
  });
});
