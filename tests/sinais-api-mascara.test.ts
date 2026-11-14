// Sinal público nas APIs de lista: título, descrição e endereço do local saem MASCARADOS (e sem «Fonte: <endereço>») na RESPOSTA, mas o casamento da
// busca, a pontuação, o filtro do passo 2, a ordem e o corte usam o texto ORIGINAL no servidor. Usuário e legado: idênticos. Nomes inventados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

const st = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], recentes: [] as Record<string, unknown>[], sqls: [] as string[] }));
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    st.sqls.push(sql);
    if (sql.includes('information_schema')) return { rows: [] };
    if (sql.includes('INTERVAL')) return { rows: st.recentes };           // apoio do passo 2 (registros recentes parecidos)
    return { rows: st.rows };
  }),
}));

import { GET } from '@/app/api/v1/objects/public/route';
import { maskSignalForPublicApi } from '@/lib/objectPublicView';
import { buscarRegistrosRecentesParecidos } from '@/lib/flowMatch/recentSimilar';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const URL_NOME = 'https://cgn.inf.br/noticia/2224709/documento-em-nome-de-maria-souza-teste-foi-encontrado-no-colonial';
const row = (o: Record<string, unknown>) => ({
  id: 'id-x', title: 'Documento encontrado no centro', description: 'Documento encontrado no centro.', status: 'found', category: 'document', type: 'document',
  location: 'Centro, Cascavel, PR', latitude: null, longitude: null, qr_code: 'COD-X', color: null, brand: null, breed: null, images: '[]',
  is_legacy: false, source: 'public_signal', reward_amount: null, reward_description: null, is_boosted: false, boost_expires_at: null,
  created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z', ...o,
});
const SINAL_MARIA = row({ id: 's1', qr_code: 'S1', title: 'Documento encontrado em nome de Maria Souza Teste', description: `Documento encontrado em nome de Maria Souza Teste. Categoria: documento. Local: Colonial, Cascavel, PR. Fonte: ${URL_NOME}`, location: 'bairro Colonial, Cascavel, PR' });
const SINAL_GENERICO = row({ id: 's2', qr_code: 'S2', title: 'Documento encontrado no centro', description: 'Documento encontrado no centro. Fonte: https://g1.globo.com/pr/noticia/x' });
const USUARIO = row({ id: 'u1', qr_code: 'U1', source: null, title: 'Chave em nome de Carlos Usuario Teste', description: 'Chave em nome de Carlos Usuario Teste, perdida. Veja https://exemplo.com/a-b', category: 'keys', type: 'keys' });
const LEGADO = row({ id: 'l1', qr_code: 'L1', source: 'webjetos', is_legacy: true, title: 'Documento em nome de Ana Legado Teste', description: 'Documento em nome de Ana Legado Teste' });
const call = async (qs: string) => (await GET(new NextRequest(`http://localhost/api/v1/objects/public?${qs}`))).json();

beforeEach(() => { st.rows = [SINAL_MARIA, SINAL_GENERICO, USUARIO, LEGADO]; st.recentes = []; st.sqls = []; });

describe('maskSignalForPublicApi (função)', () => {
  it('sinal: nome mascarado no título, na descrição e no endereço do local; sem «Fonte: <endereço>»', () => {
    const r = maskSignalForPublicApi({ source: 'public_signal', title: SINAL_MARIA.title, description: SINAL_MARIA.description, location: { address: 'Rua em nome de Maria Souza Teste, 10' } });
    expect(r.title).toBe('Documento encontrado em nome de (nome omitido)');
    expect(r.description).toBe('Documento encontrado em nome de (nome omitido). Categoria: documento. Local: Colonial, Cascavel, PR.');
    expect(JSON.stringify(r)).not.toMatch(/maria|souza|https?:/i);
  });
  it('usuário, legado e sem origem: devolve o MESMO objeto (mesma referência)', () => {
    for (const o of [{ source: null, title: 'em nome de Fulano Tal' }, { source: 'user', title: 'x' }, { source: 'webjetos', is_legacy: true, title: 'em nome de Ciclano Tal', description: 'Fonte: https://a.b/c' }, {}]) expect(maskSignalForPublicApi(o)).toBe(o);
    expect(maskSignalForPublicApi(null as unknown as object)).toBeNull();
  });
  it('falso positivo: lugares, bairros, órgãos e documentos genéricos NÃO são mascarados', () => {
    const ok = [
      'Documento encontrado na Prefeitura de Cascavel, bairro Vila Nova da Esperança', 'Carteira de Trabalho Digital encontrada no Terminal Rodoviário',
      'RG encontrado na Delegacia de Polícia Civil', 'Documento de Identidade encontrado na Praça Maria Helena', 'CNH encontrada na Câmara Municipal de Cascavel',
      'Cachorro encontrado no bairro São Cristóvão', 'Chaves encontradas na Rua Dom Pedro II', 'Cartão de crédito encontrado no Hospital Santa Casa de Misericórdia',
    ];
    for (const t of ok) expect(maskSignalForPublicApi({ source: 'public_signal', title: t, description: t }).title, t).toBe(t);
  });
  it('só tira endereço http(s): descrição sem endereço não muda', () => {
    expect(maskSignalForPublicApi({ source: 'public_signal', title: 'x', description: 'Cachorro encontrado no bairro X. Local: Centro.' }).description).toBe('Cachorro encontrado no bairro X. Local: Centro.');
  });
});

describe('/api/v1/objects/public: busca, pontuação e ordem pelo texto ORIGINAL; resposta mascarada', () => {
  it('buscar pelo NOME do documento ainda encontra o sinal, mas o título volta mascarado', async () => {
    const j = await call('status=found&keyword=maria%20souza');
    const s = j.items.find((i: { id: string }) => i.id === 's1');
    expect(s).toBeTruthy(); expect(s._score).toBeGreaterThanOrEqual(20);
    expect(s.title).toBe('Documento encontrado em nome de (nome omitido)');
    expect(JSON.stringify(j.items)).not.toMatch(/maria|souza|cgn\.inf\.br/i);        // `keywords_expanded` só ecoa o que a pessoa digitou; os itens saem sem o nome
  });
  it('a ordem vem da pontuação do texto ORIGINAL: quem casa pelo nome fica na frente de quem casa só por uma palavra (mesmo vindo depois do banco)', async () => {
    const PARCIAL = row({ id: 's3', qr_code: 'S3', source: null, title: 'Maria perdeu documento', description: 'Maria perdeu', category: 'document' });
    st.rows = [PARCIAL, SINAL_MARIA];                                   // o banco devolve o parcial ANTES
    const j = await call('keyword=maria%20souza');
    const ids = j.items.map((i: { id: string }) => i.id);
    expect(ids).toContain('s1'); expect(ids).toContain('s3');
    expect(ids.indexOf('s1')).toBeLessThan(ids.indexOf('s3'));          // pelo texto mascarado o sinal perderia os pontos do nome e ficaria atrás (ou sumiria)
    const sc = Object.fromEntries(j.items.map((i: { id: string; _score: number }) => [i.id, i._score]));
    expect(sc.s1).toBeGreaterThan(sc.s3);
  });
  it('passo 2 (strict=1): o filtro de palavra em comum também usa o texto original', async () => {
    const j = await call('status=found&keyword=documento%20maria%20souza&strict=1');
    const s = j.items.find((i: { id: string }) => i.id === 's1');
    expect(s).toBeTruthy(); expect(s.title).toContain('(nome omitido)');
  });
  it('usuário e legado: itens idênticos aos do banco (título e descrição como estão)', async () => {
    const j = await call('size=50');
    const u = j.items.find((i: { id: string }) => i.id === 'u1'); const l = j.items.find((i: { id: string }) => i.id === 'l1');
    expect(u.title).toBe('Chave em nome de Carlos Usuario Teste'); expect(u.description).toContain('https://exemplo.com/a-b');
    expect(l.title).toBe('Documento em nome de Ana Legado Teste');
  });
  it('sinal sem nome: só perde o «Fonte: <endereço>» da descrição; o título não muda', async () => {
    const j = await call('size=50'); const s = j.items.find((i: { id: string }) => i.id === 's2');
    expect(s.title).toBe('Documento encontrado no centro'); expect(s.description).toBe('Documento encontrado no centro.');
  });
  it('a lista inteira de sinais sai sem «Fonte: http» e sem o nome', async () => {
    const j = await call('size=50');
    for (const i of j.items.filter((x: { source: string }) => x.source === 'public_signal')) { expect(JSON.stringify(i)).not.toMatch(/Fonte: ?http|maria|souza/i); }
  });
  it('ids, ordem, pontuação e metadados são os mesmos de antes (a máscara não entra na conta)', async () => {
    const j = await call('keyword=documento&size=50');
    expect(j.score_threshold).toBe(20); expect(Array.isArray(j.keywords_expanded)).toBe(true);
    expect(j.items.every((i: { _score: number }, k: number, a: { _score: number }[]) => k === 0 || a[k - 1]._score >= i._score)).toBe(true);   // ordenado por pontuação
  });
});

describe('apoio do passo 2 (recent_similar): mesma máscara, mesmo filtro', () => {
  it('sinal sai mascarado; usuário igual; a chave «source» não aparece na resposta', async () => {
    st.recentes = [
      { ...SINAL_MARIA, created_at: '2026-11-12T10:00:00Z' },
      { ...USUARIO, id: 'u2', qr_code: 'U2', title: 'Documento perdido em nome de Pessoa Qualquer Teste', description: 'Documento perdido', created_at: '2026-11-12T09:00:00Z' },
    ];
    const r = await buscarRegistrosRecentesParecidos('documento maria souza', 'found');
    const s = r.find((i) => i.id === 's1')!; const u = r.find((i) => i.id === 'u2')!;
    expect(s.title).toBe('Documento encontrado em nome de (nome omitido)'); expect(JSON.stringify(s)).not.toMatch(/maria|souza|https?:/i);
    expect(u.title).toBe('Documento perdido em nome de Pessoa Qualquer Teste');           // usuário: como está
    for (const i of r) expect(Object.keys(i)).not.toContain('source');
    expect(Object.keys(s).sort()).toEqual(['category', 'created_at', 'description', 'id', 'location', 'photos', 'status', 'title', 'unique_code']);
  });
});

describe('no código', () => {
  it('a máscara entra DEPOIS do filtro, da ordenação e do corte; o SQL e a pontuação não foram tocados', () => {
    const r = read('src/app/api/v1/objects/public/route.ts');
    const corte = r.indexOf('.slice(0, requestedSize)'); const mascara = r.indexOf('selecionados.map(maskSignalForPublicApi)');
    expect(corte).toBeGreaterThan(0); expect(mascara).toBeGreaterThan(corte);
    expect(r).toContain('_score: keyword.length > 0 ? calcularScoreBusca(keyword, row) : 100,');                     // pontuação sobre a linha ORIGINAL
    expect(r).toContain('(LOWER(title) LIKE $${p} OR LOWER(description) LIKE $${p}');                                 // casamento no SQL sobre o texto original
    expect(r).toContain('const nextCursor = items.length === requestedSize');
  });
  it('mapa, API do Feed, API do objeto e sitemap NÃO foram alterados por este PR', () => {
    for (const f of ['src/app/api/v1/objects/map/route.ts', 'src/app/api/v1/feed/route.ts', 'src/app/api/v1/objects/scan/[code]/route.ts', 'src/app/sitemap.ts']) expect(read(f), f).not.toMatch(/maskSignalForPublicApi|semEnderecoDeFonte/);
    expect(read('src/lib/feed/query.ts')).toContain('source_url: url, source_name: sourceName(url),');                 // o botão da fonte do card continua dependendo disso
  });
  it('a máscara de nomes em texto não ganhou regra para endereço: um endereço só pode ser ocultado, nunca «mascarado» (o link precisa continuar funcionando)', () => {
    expect(read('src/lib/privacy/maskPersonNames.ts')).not.toMatch(/https?|hífen|hyphen|slug/i);
  });
});
