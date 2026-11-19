// ETAPA 1 (enxuta): vocabulário por FAMÍLIA só para a busca (Feed e /achei, via `amplo=1`); matching e fluxos /flow/* congelados.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest@2 run --config tests/vitest.config.ts tests/vocabulario-familias.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { calculateMatchScore, hasTextOverlap } from '@/lib/matching';
import { SINONIMOS, calcularScoreBusca, expandirKeyword, tokenizar } from '@/lib/buscaPublica';
import { compilarFamilias, casaCategoria, casaFamilia, nivelDoItem } from '@/lib/buscaFamilias';
import { FAMILIAS, FORA_DO_VOCABULARIO } from '@/lib/buscaVocabulario';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

// ── Valores medidos na main ANTES da etapa 1 (matching e busca sem opções) ──
const GOLDEN = {"matching": {"Carro prata perdido|Automóvel prata achado": [77, 77, 84, true], "Óculos de grau preto|Lentes de contato": [70, 70, 77, true], "Celular Samsung azul|Telefone achado no ônibus": [70, 70, 77, true], "Bolsa preta|Mochila preta encontrada": [77, 77, 84, true], "Cachorro caramelo|Pet encontrado na praça": [70, 70, 77, true], "Documento RG perdido|Identidade encontrada": [70, 70, 77, true], "Moto vermelha roubada|Motocicleta vermelha achada": [77, 77, 84, true], "Bicicleta azul|Bike azul encontrada": [77, 77, 84, true], "Chave de carro|Chaves encontradas": [70, 70, 77, true], "Carteira preta|Carteira de couro achada": [77, 70, 77, true]}, "busca": {"carro": "10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0", "moto": "0,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0", "veiculo": "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0", "bicicleta": "0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0", "oculos": "0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0", "celular": "0,0,0,0,40,40,0,0,0,0,0,0,0,0,0,0,0,0,0,0", "pet": "0,0,0,0,0,0,0,0,20,20,0,0,0,0,0,0,0,0,0,0", "cachorro": "0,0,0,0,0,0,0,0,50,20,0,0,0,0,0,0,0,0,0,0", "carteira": "0,0,0,0,0,0,20,10,0,0,0,0,0,0,0,0,0,0,50,50", "documento": "0,0,0,0,0,0,0,0,0,0,40,40,0,0,0,0,0,0,0,0", "bolsa vermelha": "0,0,0,0,0,0,50,50,0,0,0,0,10,10,0,0,0,0,20,20", "chave": "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,30,30,0,0", "onibus": "0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0", "rg": "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"}, "expandir": {"carro": "carro", "moto": "moto", "veiculo": "veiculo", "bicicleta": "bicicleta", "oculos": "oculos,oculo", "celular": "celular,telefone,smartphone,iphone,android,aparelho,samsung,motorola", "pet": "pet", "cachorro": "cachorro,cao,dog,pet,animal,canino", "carteira": "carteira,wallet,bolsa,porta-documentos", "documento": "documento,documentos,rg,cpf,identidade,passaporte,habilitacao,cnh", "bolsa vermelha": "bolsa vermelha,bolsa,mochila,sacola,bag,pochete,carteira,maleta,pasta,vermelha", "chave": "chave,chaves,chaveiro,key", "onibus": "onibus,onibu", "rg": "rg"}} as { matching: Record<string, [number, number, number, boolean]>; busca: Record<string, string>; expandir: Record<string, string> };
const PARES: Array<[string, string, string, string]> = [
  ['Carro prata perdido', 'Automóvel prata achado', 'vehicle', 'vehicle'], ['Óculos de grau preto', 'Lentes de contato', 'other', 'other'],
  ['Celular Samsung azul', 'Telefone achado no ônibus', 'phone', 'phone'], ['Bolsa preta', 'Mochila preta encontrada', 'bag', 'bag'],
  ['Cachorro caramelo', 'Pet encontrado na praça', 'pet', 'pet'], ['Documento RG perdido', 'Identidade encontrada', 'document', 'document'],
  ['Moto vermelha roubada', 'Motocicleta vermelha achada', 'vehicle', 'vehicle'], ['Bicicleta azul', 'Bike azul encontrada', 'bike', 'bike'],
  ['Chave de carro', 'Chaves encontradas', 'keys', 'keys'], ['Carteira preta', 'Carteira de couro achada', 'wallet', 'wallet'],
];

describe('MATCHING e busca ANTIGA congelados (pontuação igual à de antes da etapa 1)', () => {
  it('matching: calculateMatchScore e hasTextOverlap dão exatamente os mesmos valores nas 10 amostras (3 modos de pontuação)', () => {
    for (const [t1, t2, c1, c2] of PARES) {
      const a = { title: t1, description: 'Perdi ontem no centro', category: c1, latitude: '-24.95', longitude: '-53.45', color: null, brand: null };
      const b = { title: t2, description: 'Achado ontem no centro', category: c2, latitude: '-24.951', longitude: '-53.451', color: null, brand: null };
      expect([calculateMatchScore(a, b), calculateMatchScore(a, b, { synonyms: true }), calculateMatchScore(a, b, { synonyms: true, description: true }), hasTextOverlap(a, b)], `${t1}|${t2}`).toEqual(GOLDEN.matching[`${t1}|${t2}`]);
    }
  });
  it('busca sem opções (fluxos /flow/*, API pública padrão): expansão e nota iguais às de antes, nas 14 buscas × 20 itens', () => {
    const itens = PARES.flatMap(([t1, t2, c1, c2]) => [{ title: t1, description: 'Perdi ontem no centro', color: null, category: c1 }, { title: t2, description: 'Achado ontem no centro', color: null, category: c2 }]);
    for (const q of Object.keys(GOLDEN.busca)) {
      expect(itens.map((i) => calcularScoreBusca(q, i)).join(','), q).toBe(GOLDEN.busca[q]);
      expect(expandirKeyword(q).join(','), q).toBe(GOLDEN.expandir[q]);
    }
  });
  it('o dicionário ANTIGO (SINONIMOS) segue com as mesmas 23 chaves e o defeito do radical (congelado de propósito)', () => {
    expect(Object.keys(SINONIMOS).length).toBe(23);
    expect(expandirKeyword('oculos')).toEqual(['oculos', 'oculo']); expect(expandirKeyword('onibus')).toEqual(['onibus', 'onibu']);
    expect(tokenizar('rg do carro,')).toEqual(['carro,']);                 // antigo: descarta «rg» e não separa pontuação
  });
  it('o matching tem o SEU dicionário (cópia independente) e não importa a busca nem o dicionário ampliado', () => {
    const m = read('src/lib/matching.ts');
    expect(m).toContain('const SINONIMOS: Record<string, string[]> = {');
    expect(m).not.toMatch(/buscaPublica|buscaDicionario|DICIONARIO_AMPLIADO/);
  });
  it('fluxos /flow/* e a API pública: ninguém pede `amplo` além do /achei; a API ignora `amplo` com strict=1', () => {
    const base = path.join(__dirname, '..', 'src/app');
    const arquivos: string[] = [];
    const ler = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) ler(p); else if (/\.(ts|tsx)$/.test(n)) arquivos.push(p); } };
    ler(base);
    const usam = arquivos.filter((p) => /amplo['"=]/.test(readFileSync(p, 'utf8'))).map((p) => path.relative(base, p)).sort();
    expect(usam).toEqual(['achei/client.tsx', 'api/v1/objects/public/route.ts']);
    expect(read('src/app/api/v1/objects/public/route.ts')).toContain("const amplo = searchParams.get('amplo') === '1' && !strict;");
    for (const f of ['wallet', 'lost', 'pet', 'vehicle', 'keys', 'phone', 'bike', 'found']) expect(read(`src/app/flow/${f}/client.tsx`), f).not.toContain('amplo');
  });
});


const nivel = (q: string, item: Record<string, unknown>, nota = 0) => nivelDoItem(q, compilarFamilias(q), item, nota, 20);
const CARRO = { title: 'Roubaram carro do meu pai do dia das mães as 21:30 da noite', description: 'Chevrolet spin cor cinza 2020', category: 'vehicle' };

describe('vocabulário por família: enxuto, em dados, num lugar só', () => {
  it('vocabulário só em buscaVocabulario.ts; famílias pedidas presentes; tipos e marcas/modelos dos veículos; sem acento e minúsculas', () => {
    expect(FAMILIAS.map((f) => f.nome)).toEqual(['veiculos', 'bicicletas', 'documentos', 'celulares', 'eletronicos', 'pets', 'bolsas', 'carteiras', 'chaves', 'joias', 'relogios']);
    const v = FAMILIAS.find((f) => f.nome === 'veiculos')!.termos!;
    for (const t of ['carro', 'automovel', 'veiculo', 'caminhonete', 'picape', 'van', 'caminhao', 'moto', 'chevrolet', 'fiat', 'volkswagen', 'ford', 'honda', 'toyota', 'hyundai', 'yamaha', 'spin', 'civic', 'corolla', 'hb20', 'hilux', 'cg 150', 'biz']) expect(v, t).toContain(t);
    for (const f of FAMILIAS) {
      const todos = [...(f.termos ?? []), ...(f.grupos ?? []).flat(), ...(f.guardaChuva ?? []), ...(f.ambiguos ?? []).flatMap((a) => [a.termo, ...a.comContexto])];
      for (const t of todos) expect(t, `${f.nome}: ${t}`).toMatch(/^[a-z0-9 -]+$/);
      expect((f.termos?.length ?? 0) + (f.grupos?.flat().length ?? 0), f.nome).toBeLessThanOrEqual(50);   // enxuto: nada de lista exaustiva
    }
    expect(read('src/lib/buscaFamilias.ts')).toContain("from './buscaVocabulario'");
  });
  it('AMBÍGUAS fora: gol/up/fit/uno/onix/ka/polo/cg/pop/fan/tracker/creta só com contexto; sol, auto, fazer… nem entram', () => {
    const amb = FAMILIAS.find((f) => f.nome === 'veiculos')!.ambiguos!.map((a) => a.termo);
    for (const t of ['gol', 'up', 'fit', 'uno', 'onix', 'ka', 'polo', 'cg', 'pop', 'fan', 'tracker', 'creta']) expect(amb, t).toContain(t);
    const soltas = FAMILIAS.flatMap((f) => [...(f.termos ?? []), ...(f.grupos ?? []).flat(), ...(f.guardaChuva ?? [])]);
    for (const t of [...amb, ...FORA_DO_VOCABULARIO.map((x) => x.termo)]) expect(soltas, t).not.toContain(t);
    expect(FORA_DO_VOCABULARIO.map((x) => x.termo)).toEqual(expect.arrayContaining(['sol', 'auto', 'fazer', 'molho', 'filhote', 'ouro']));
    for (const x of FORA_DO_VOCABULARIO) expect(x.motivo.length, x.termo).toBeGreaterThan(10);
  });
});

describe('família e categoria (puro, sem banco)', () => {
  it('«carro» acha «Chevrolet Spin cinza 2020» (família) e «Honda» acha carro e moto Honda; tipo→marca→modelo', () => {
    expect(nivel('carro', { title: 'Chevrolet Spin cinza 2020', description: '', category: 'vehicle' })).toBe(1);
    expect(nivel('honda', { title: 'Moto Honda CG 150 roubada', description: '', category: 'vehicle' })).toBe(0);      // «honda» está no texto: palavra exata
    expect(nivel('honda', { title: 'Carro prata roubado', description: 'Toyota Corolla', category: 'vehicle' })).toBe(1);  // outra palavra da família
    expect(nivel('caminhonete', { title: 'Hilux branca', description: '', category: 'vehicle' })).toBe(1);
    expect(nivel('spin', { title: 'Roubaram carro do meu pai', description: 'Chevrolet', category: 'vehicle' })).toBe(1);
    expect(nivel('carro', CARRO)).toBe(0);                                                                                  // palavra exata vem primeiro (nível 0)
  });
  it('categoria: «carro» acha categoria Veículo mesmo com título sem a palavra; NUNCA legado', () => {
    expect(nivel('carro', { title: 'Perdi minha CG', description: '', category: 'vehicle' })).toBe(1);
    expect(nivel('carro', { title: 'Perdi minha CG', description: '', category: 'vehicle', is_legacy: true })).toBeNull();
    expect(casaCategoria(compilarFamilias('moto'), { category: 'vehicle' })).toBe(true); expect(casaCategoria(compilarFamilias('moto'), { category: 'keys' })).toBe(false);
  });
  it('conflito de categoria: «carro» NÃO acha «Chaves da Honda» (categoria chaves) nem família de outra categoria', () => {
    expect(nivel('carro', { title: 'Chaves da Honda', description: 'Molho com chaveiro', category: 'keys' })).toBeNull();
    expect(casaFamilia(compilarFamilias('carro'), { title: 'Chaves da Honda', category: 'keys' })).toBe(false);
    expect(nivel('honda', { title: 'Chaves da Honda', description: '', category: 'keys' })).toBe(0);                          // mas a palavra EXATA «honda» acha
    expect(nivel('carro', { title: 'Documento do carro Honda', description: '', category: 'document' })).toBe(0);              // palavra exata «carro» (regra do #154)
    expect(nivel('carro', { title: 'Perdi minha chave', description: 'Chevrolet', category: 'keys' })).toBeNull();
    expect(nivel('carro', { title: 'Achei Honda', description: '', category: 'found' })).toBe(1);                              // categoria suja é neutra
  });
  it('a família é larga só onde faz sentido: cachorro NÃO acha gato; «pet» acha os dois; «cachorro» acha «pet»', () => {
    expect(nivel('cachorro', { title: 'Gata preta desapareceu', description: '', category: 'pet' })).toBeNull();
    expect(nivel('pet', { title: 'Gata preta desapareceu', description: '', category: 'pet' })).toBe(1);
    expect(nivel('cachorro', { title: 'Cachorra caramelo', description: '', category: 'pet' })).toBe(1);
    expect(nivel('cachorro', { title: 'Pet encontrado na praça', description: '', category: 'pet' })).toBe(1);
    expect(nivel('veiculo', { title: 'Bicicleta azul', description: '', category: 'bike' })).toBe(1);                              // guarda-chuva «veiculo» acha bicicleta
    expect(nivel('carro', { title: 'Bicicleta azul', description: '', category: 'bike' })).toBeNull();
  });
  it('documentos, celular, bolsas, joias: grupos próprios', () => {
    expect(nivel('rg', { title: 'Identidade encontrada', description: '', category: 'document' })).toBe(1);
    expect(nivel('rg', { title: 'Perdi minha CNH', description: '', category: 'document' })).toBeNull();     // rg≠cnh: nenhuma categoria inteira para «rg»
    expect(nivel('cnh', { title: 'Habilitação perdida', description: '', category: 'document' })).toBe(1);
    expect(nivel('iphone', { title: 'Samsung Galaxy azul', description: '', category: 'phone' })).toBe(1);
    expect(nivel('bolsa', { title: 'Mochila preta', description: '', category: 'bag' })).toBe(1);
    expect(nivel('anel', { title: 'Aliança de ouro', description: '', category: 'jewelry' })).toBe(1);
  });
  it('ambíguas: «gol» sozinha não vale (nem na busca nem no texto); com contexto vale', () => {
    expect(compilarFamilias('gol').termos).toEqual([]);                                                                         // a busca «gol» não ativa a família
    expect(nivel('carro', { title: 'Meu gol azul', description: '', category: 'vehicle' })).toBe(1);                              // categoria Veículo (não pela palavra «gol»)
    expect(nivel('carro', { title: 'Gol no fim do jogo ontem', description: 'torcida', category: 'other' })).toBeNull();                  // sem contexto
    expect(nivel('carro', { title: 'Gol da VW parado', description: 'perto do mercado', category: 'other' })).toBe(1);                 // com contexto («vw»)
    expect(compilarFamilias('gol vw').termos).toContain('gol');                                                                 // contexto na própria busca
    expect(compilarFamilias('onix').termos).toEqual([]);                                                                        // «ônix» (pedra) fora
  });
  it('radical e acento: «oculos»/«onibus» agora casam (plural simples), «Óculos» sem acento', () => {
    const o = { title: 'Óculos de grau', description: '', category: 'other' };
    const { calcularScoreBusca: nota } = { calcularScoreBusca };
    expect(nota('oculos', o, { radical: true, semAcento: true })).toBeGreaterThanOrEqual(20);
    expect(nota('oculos', o)).toBeLessThan(20);                                                                                 // antigo: defeito preservado
    expect(nivel('oculos', o, nota('oculos', o, { radical: true }))).toBe(0);
    expect(compilarFamilias('carros').categorias).toEqual(['vehicle']); expect(compilarFamilias('Veículo').categorias).toContain('vehicle');
  });
});

describe.skipIf(!TEST_DB)('busca com banco real (Feed e /achei)', () => {
  let pool: Pool; let busca: typeof import('@/lib/feed/busca'); let q: typeof import('@/lib/feed/query'); let GETPUB: (r: NextRequest) => Promise<Response>;
  const reset = async () => {
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8')); await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    await pool.query(`INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,images,created_at,updated_at,user_id) VALUES
      ('Roubaram carro do meu pai do dia das mães as 21:30 da noite','Chevrolet spin cor cinza 2020','stolen','vehicle','6Y8MMHIH',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:00','2026-11-12 10:00',gen_random_uuid()),
      ('Honda CG roubada no bairro Alto','Placa final 4','stolen','vehicle','V0000002',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:01','2026-11-12 10:01',gen_random_uuid()),
      ('Hilux branca furtada','Caminhonete','stolen','vehicle','V0000003',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:02','2026-11-12 10:02',gen_random_uuid()),
      ('Chaves da Honda','Molho com chaveiro','lost','keys','K0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:03','2026-11-12 10:03',gen_random_uuid()),
      ('Gol no fim da final','Jogo de ontem','lost','other','X0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:04','2026-11-12 10:04',gen_random_uuid()),
      ('Bicicleta azul roubada','Bike aro 26','stolen','bike','B0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:05','2026-11-12 10:05',gen_random_uuid()),
      ('Cachorra desapareceu no bairro Alto','Filhote caramelo','lost','pet','P0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:07','2026-11-12 10:07',gen_random_uuid()),
      ('Gata preta desapareceu','Muito dócil','lost','pet','P0000002',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:08','2026-11-12 10:08',gen_random_uuid()),
      ('Honda antiga do legado','Registro antigo','lost','vehicle','V0000009',true,true,NULL,'Rua Antiga 1, São Paulo, SP','[]','2024-01-01','2024-01-01',NULL),
      ('Óculos de grau preto','Armação preta','lost','other','O0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:09','2026-11-12 10:09',gen_random_uuid())`);
    q.resetFeedCache();
  };
  const codes = async (t: string) => (await busca.buscarNoFeed(t, {})).items.map((i) => i.code);
  const pub = async (qs: string) => { const r = await GETPUB(new NextRequest(`http://localhost/api/v1/objects/public?${qs}`)); return ((await r.json()).items as Array<{ unique_code: string }>).map((i) => i.unique_code); };
  beforeAll(async () => { pool = new Pool({ connectionString: TEST_DB }); q = await import('@/lib/feed/query'); busca = await import('@/lib/feed/busca'); ({ GET: GETPUB } = await import('@/app/api/v1/objects/public/route')); });
  beforeEach(reset);
  afterAll(async () => { await pool?.end(); });

  it('Feed: «carro» acha a ocorrência 6Y8MMHIH em 1º (palavra exata) e, depois, outros veículos por família/categoria; NÃO acha «Chaves da Honda» nem legado nem o «Gol» do futebol', async () => {
    const c = await codes('carro');
    expect(c).toContain('6Y8MMHIH'); expect(c).toContain('V0000002'); expect(c).toContain('V0000003');
    for (const x of ['K0000001', 'V0000009', 'X0000001', 'B0000001', 'P0000001']) expect(c, x).not.toContain(x);
    expect(c.indexOf('6Y8MMHIH')).toBeLessThan(c.indexOf('V0000002'));        // exata antes de família/categoria
  });
  it('Feed: «honda» acha carro e moto Honda (e as chaves da Honda pela palavra exata, mas só no fim?) e «chevrolet»/«spin» acham 6Y8MMHIH; «caminhonete» acha a Hilux', async () => {
    const h = await codes('honda'); expect(h).toContain('V0000002'); expect(h).toContain('K0000001'); expect(h).toContain('6Y8MMHIH'); expect(h).not.toContain('V0000009');
    expect(h.indexOf('V0000002')).toBeLessThan(h.indexOf('6Y8MMHIH'));        // exata (Honda) antes da família
    expect(await codes('chevrolet')).toContain('6Y8MMHIH'); expect(await codes('spin')).toContain('6Y8MMHIH'); expect(await codes('caminhonete')).toContain('V0000003');
  });
  it('Feed: pets e outros: cachorro acha cachorra e não a gata; pet acha todos; veiculo acha bicicleta; oculos acha o óculos', async () => {
    const cach = await codes('cachorro'); expect(cach).toContain('P0000001'); expect(cach).not.toContain('P0000002');
    const pet = await codes('pet'); expect(pet).toContain('P0000001'); expect(pet).toContain('P0000002');
    expect(await codes('veiculo')).toEqual(expect.arrayContaining(['6Y8MMHIH', 'V0000002', 'B0000001'])); expect(await codes('oculos')).toContain('O0000001');
  });
  it('Feed: «gol» sozinha só acha a palavra exata (o futebol), sem trazer carros; sem lixo; só os campos do card', async () => {
    const g = await codes('gol'); expect(g).toContain('X0000001'); expect(g).not.toContain('6Y8MMHIH'); expect(g).not.toContain('V0000002');
    expect(await codes('foguete espacial')).toEqual([]);
    const r = await busca.buscarNoFeed('carro', {}); expect(r.ampla).toBe(true);
    for (const it of r.items) expect(Object.keys(it).sort()).toEqual(['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title']);
  });
  it('/achei: SEM `amplo` o resultado é o de antes e a resposta tem os mesmos campos; COM `amplo=1` acha por família/categoria, sem legado', async () => {
    const sem = await pub('status=stolen&size=20&keyword=chevrolet'); const com = await pub('status=stolen&size=20&amplo=1&keyword=carro');
    expect(com).toContain('6Y8MMHIH'); expect(com).toContain('V0000002'); expect(com).not.toContain('V0000009');
    expect(sem).toContain('6Y8MMHIH');                                                              // «chevrolet» já está na descrição: igual a antes
    expect(await pub('status=stolen&size=20&keyword=carro')).not.toContain('V0000002');           // antigo: sem família/categoria
    const r = await GETPUB(new NextRequest('http://localhost/api/v1/objects/public?status=stolen&size=5&amplo=1&keyword=carro')); const j = await r.json();
    for (const it of j.items) { expect(Object.keys(it)).not.toContain('_nivel'); expect(Object.keys(it)).not.toContain('_exatas'); }
  });
  it('fluxos: strict=1 ignora `amplo` (mesma resposta com e sem ele)', async () => {
    for (const kw of ['carro', 'honda', 'documento', 'celular', 'oculos grau']) {
      expect(await pub(`status=found&size=5&strict=1&amplo=1&keyword=${encodeURIComponent(kw)}`), kw).toEqual(await pub(`status=found&size=5&strict=1&keyword=${encodeURIComponent(kw)}`));
    }
  });
});
