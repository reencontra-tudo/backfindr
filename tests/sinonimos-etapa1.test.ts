// ETAPA 1 dos sinônimos: dicionário ampliado SÓ para a busca (Feed e /achei, via `amplo=1`); matching e fluxos /flow/* congelados. Sem banco nas duas primeiras partes.
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test npx vitest@2 run --config tests/vitest.config.ts tests/sinonimos-etapa1.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { calculateMatchScore, hasTextOverlap } from '@/lib/matching';
import { DICIONARIO_AMPLIADO, SINONIMOS, calcularScoreBusca, categoriasDaBuscaTexto, expandirKeyword, expandirTokens, normalizarPalavra, tokenizar } from '@/lib/buscaPublica';
import { CATEGORIAS, GRUPOS, RELACOES } from '@/lib/buscaDicionario';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const AMP = { dicionario: 'ampliado' as const, radical: true, semAcento: true };

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

describe('dicionário ampliado: pares, radical, categoria', () => {
  const exp = (q: string) => [...expandirTokens(tokenizar(q, AMP), AMP)];
  it('um lugar só (buscaDicionario.ts), organizado por grupo, em dados; termos sem acento e minúsculos; grupos com 2+ termos sem repetição', () => {
    for (const g of GRUPOS) { expect(g.termos.length, g.nome).toBeGreaterThanOrEqual(2); expect(new Set(g.termos).size, g.nome).toBe(g.termos.length); }
    for (const t of [...GRUPOS.flatMap((g) => g.termos), ...RELACOES.flatMap((r) => [r.de, ...r.para]), ...CATEGORIAS.flatMap((c) => c.termos)]) expect(t, t).toMatch(/^[a-z0-9]+$/);
    expect(read('src/lib/buscaPublica.ts')).toContain("from './buscaDicionario'");
    expect(Object.keys(DICIONARIO_AMPLIADO).length).toBeGreaterThan(Object.keys(SINONIMOS).length);
  });
  it('veículos: carro ⇄ automóvel ⇄ auto; moto ⇄ motocicleta; bicicleta ⇄ bike; «veiculo» acha os específicos', () => {
    expect(exp('carro')).toEqual(expect.arrayContaining(['automovel', 'auto'])); expect(exp('automovel')).toEqual(expect.arrayContaining(['carro', 'auto']));
    expect(exp('moto')).toContain('motocicleta'); expect(exp('motocicleta')).toContain('moto');
    expect(exp('bicicleta')).toContain('bike'); expect(exp('bike')).toContain('bicicleta');
    expect(exp('veiculo')).toEqual(expect.arrayContaining(['carro', 'automovel', 'moto', 'motocicleta']));
  });
  it('conservador: «carro» NÃO vira «chave»; «carro» não vira «veiculo» nem «moto» (guarda-chuva de um sentido só)', () => {
    expect(exp('carro')).not.toContain('chave'); expect(exp('chave')).not.toContain('carro');
    expect(exp('carro')).not.toContain('veiculo'); expect(exp('carro')).not.toContain('moto'); expect(exp('moto')).not.toContain('carro');
    expect(exp('anel')).not.toContain('colar'); expect(exp('joia')).toEqual(expect.arrayContaining(['anel', 'colar']));
  });
  it('documentos, pets, cartão, mala, celular', () => {
    expect(exp('rg')).toContain('identidade'); expect(exp('identidade')).toEqual(expect.arrayContaining(['rg']));
    expect(exp('cnh')).toContain('habilitacao'); expect(exp('habilitacao')).toContain('cnh');
    expect(exp('cachorro')).toEqual(expect.arrayContaining(['cachorra', 'cadela'])); expect(exp('gato')).toContain('gata');
    expect(exp('pet')).toEqual(expect.arrayContaining(['animal', 'cachorro', 'gato'])); expect(exp('animal')).toContain('pet');
    expect(exp('cartao')).toEqual(expect.arrayContaining(['credito', 'debito'])); expect(exp('mala')).toContain('bagagem'); expect(exp('celular')).toEqual(expect.arrayContaining(['telefone', 'xiaomi']));
  });
  it('radical corrigido SÓ no ampliado: «oculos» e «onibus» agora expandem (no antigo continuam sem)', () => {
    expect(exp('oculos')).toEqual(expect.arrayContaining(['lente', 'grau', 'armacao'])); expect(exp('onibus')).toEqual(expect.arrayContaining(['coletivo', 'bus']));
    expect(expandirKeyword('oculos', AMP)).toEqual(expect.arrayContaining(['lentes', 'grau']));
    expect(expandirKeyword('oculos').includes('lentes')).toBe(false);
  });
  it('palavras curtas conhecidas («rg») e pontuação («carro,») só valem no ampliado', () => {
    expect(tokenizar('RG do carro, azul', AMP)).toEqual(['rg', 'carro', 'azul']); expect(tokenizar('RG do carro, azul')).toEqual(['carro,', 'azul']);
  });
  it('categoria: carro/moto/automóvel/veículo → Veículo; bicicleta → bike; pet/animal → pet+animal; documento; chave → keys; «carro» NÃO pede keys; «rg» não pede categoria', () => {
    for (const t of ['carro', 'moto', 'automovel', 'veiculo', 'Motocicleta']) expect(categoriasDaBuscaTexto(t, AMP), t).toEqual(['vehicle']);
    expect(categoriasDaBuscaTexto('bicicleta', AMP)).toEqual(['bike']); expect(categoriasDaBuscaTexto('pet', AMP).sort()).toEqual(['animal', 'pet']);
    expect(categoriasDaBuscaTexto('documento', AMP)).toEqual(['document']); expect(categoriasDaBuscaTexto('chave', AMP)).toEqual(['keys']);
    expect(categoriasDaBuscaTexto('carro', AMP)).not.toContain('keys'); expect(categoriasDaBuscaTexto('rg', AMP)).toEqual([]); expect(categoriasDaBuscaTexto('foguete', AMP)).toEqual([]);
    expect(categoriasDaBuscaTexto('carro')).toEqual([]);   // sem a opção: nada muda
  });
  it('nota: categoria soma 20 (alcança o mínimo) só no ampliado, e nunca para legado', () => {
    const moto = { title: 'Honda CG roubada', description: 'Placa final 4', color: null, category: 'vehicle', is_legacy: false };
    expect(calcularScoreBusca('carro', moto, AMP)).toBeGreaterThanOrEqual(20);
    expect(calcularScoreBusca('carro', moto)).toBe(0);                                // antigo: nada
    expect(calcularScoreBusca('carro', { ...moto, is_legacy: true }, AMP)).toBe(0);   // legado: sem bônus de categoria (o título dele não tem a palavra)
  });
});

describe.skipIf(!TEST_DB)('busca com banco real (Feed e /achei)', () => {
  let pool: Pool; let busca: typeof import('@/lib/feed/busca'); let q: typeof import('@/lib/feed/query'); let GETPUB: (r: NextRequest) => Promise<Response>;
  const reset = async () => {
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8')); await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    await pool.query(`INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,images,created_at,updated_at,user_id) VALUES
      ('Roubaram carro do meu pai do dia das mães as 21:30 da noite','Chevrolet spin cor cinza 2020','stolen','vehicle','V0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:00','2026-11-12 10:00',gen_random_uuid()),
      ('Honda CG roubada no bairro Alto','Placa final 4','stolen','vehicle','V0000002',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:01','2026-11-12 10:01',gen_random_uuid()),
      ('Bicicleta azul roubada','Bike aro 26','stolen','bike','B0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:02','2026-11-12 10:02',gen_random_uuid()),
      ('Cachorra desapareceu no bairro Alto','Filhote caramelo','lost','pet','P0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:07','2026-11-12 10:07',gen_random_uuid()),
      ('Perdeu a CNH no centro','Carteira de motorista','lost','document','D0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:09','2026-11-12 10:09',gen_random_uuid()),
      ('Honda antiga do legado','Registro antigo','lost','vehicle','V0000009',true,true,NULL,'Rua Antiga 1, São Paulo, SP','[]','2024-01-01','2024-01-01',NULL),
      ('Óculos de grau preto','Armação preta','lost','other','O0000001',true,false,NULL,'Centro, Cascavel, PR','[]','2026-11-12 10:04','2026-11-12 10:04',gen_random_uuid())`);
    q.resetFeedCache();
  };
  const codes = async (t: string) => (await busca.buscarNoFeed(t, {})).items.map((i) => i.code);
  const pub = async (qs: string) => { const r = await GETPUB(new NextRequest(`http://localhost/api/v1/objects/public?${qs}`)); return ((await r.json()).items as Array<{ unique_code: string }>).map((i) => i.unique_code); };
  beforeAll(async () => { pool = new Pool({ connectionString: TEST_DB }); q = await import('@/lib/feed/query'); busca = await import('@/lib/feed/busca'); ({ GET: GETPUB } = await import('@/app/api/v1/objects/public/route')); });
  beforeEach(reset);
  afterAll(async () => { await pool?.end(); });

  it('Feed: «veiculo» e «automovel» acham carro e moto; «carro» acha também o veículo de título diferente (por categoria); legado NUNCA', async () => {
    for (const t of ['veiculo', 'automovel', 'carro']) { const c = await codes(t); expect(c, t).toContain('V0000001'); expect(c, t).toContain('V0000002'); expect(c, t).not.toContain('V0000009'); }
    expect((await codes('carro'))[0]).toBe('V0000001');      // a palavra no título + categoria vem na frente
  });
  it('Feed: sinônimos novos (bike→bicicleta, cachorro→cachorra, rg/cnh) e «pet» acha por categoria', async () => {
    expect(await codes('bike')).toContain('B0000001'); expect(await codes('cachorro')).toContain('P0000001');
    expect(await codes('cnh')).toContain('D0000001'); expect(await codes('pet')).toContain('P0000001'); expect(await codes('oculos')).toContain('O0000001');
  });
  it('Feed: continua só elegíveis, sem busca ampla bloqueando, sem lixo (texto sem relação não acha nada) e só os campos do card', async () => {
    const r = await busca.buscarNoFeed('veiculo', {}); expect(r.ampla).toBe(true); expect(r.items.length).toBeGreaterThan(0);
    expect(await codes('foguete espacial')).toEqual([]); expect(await codes('submarino')).toEqual([]);
    for (const it of r.items) expect(Object.keys(it).sort()).toEqual(['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label', 'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title']);
  });
  it('/achei: SEM `amplo` o resultado é o de antes; COM `amplo=1` acha por sinônimo/categoria e nunca traz legado só pela categoria', async () => {
    expect(await pub('status=lost&size=20&keyword=cachorro')).not.toContain('P0000001');         // antigo: «cachorra» não era sinônimo
    expect(await pub('status=lost&size=20&amplo=1&keyword=cachorro')).toContain('P0000001');
    expect(await pub('status=lost&size=20&amplo=1&keyword=moto')).not.toContain('V0000009');      // legado: sem bônus de categoria (o título dele não tem a palavra)
    expect(await pub('status=lost&size=20&keyword=oculos')).not.toContain('O0000001');           // o defeito do radical continua no antigo
    expect(await pub('status=lost&size=20&amplo=1&keyword=oculos')).toContain('O0000001');
  });
  it('fluxos: strict=1 ignora `amplo` (mesma resposta com e sem ele), e a resposta sem `amplo` não muda', async () => {
    for (const kw of ['carro', 'moto', 'documento', 'celular', 'oculos grau']) {
      expect(await pub(`status=found&size=5&strict=1&amplo=1&keyword=${encodeURIComponent(kw)}`), kw).toEqual(await pub(`status=found&size=5&strict=1&keyword=${encodeURIComponent(kw)}`));
    }
  });
});
