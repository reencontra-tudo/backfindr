// Testes do Feed «Ocorrências recentes» (Fase 1).
// Parte 1: funções puras (sempre rodam). Parte 2: integração com Postgres REAL (só com TEST_DATABASE_URL):
//
//   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/backfindr_test \
//     npx vitest@2 run --config tests/vitest.config.ts tests/feed.test.ts
//
// ATENÇÃO: a parte 2 recria as tabelas do banco de teste (tests/fixtures/feed-schema.sql). Use banco descartável.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NextRequest } from 'next/server';

// O vitest compila JSX no modo clássico; a página usa o modo automático do Next.
(globalThis as unknown as { React: typeof React }).React = React;

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { maskPersonNames, MASK_PLACEHOLDER } from '@/lib/privacy/maskPersonNames';
import { feedCategoryKey, FEED_CATEGORY_LABELS } from '@/lib/feed/category';
import { parseLocation, NO_LOCATION_LABEL, cityFromCoordinates, bandFor } from '@/lib/feed/location';
import { rankFeed, signalCapHolds, type Rankable } from '@/lib/feed/order';
import { relativeTimeLabel } from '@/lib/feed/time';
import { encodeCursor, decodeCursor } from '@/lib/feed/query';

// Nomes sintéticos usados nos dados de teste (tests/fixtures/feed-seed.sql)
const NAMES = ['Pablo Miguel Ferreira de Melo Sebastiani', 'Marco Antônio Padovani', 'Filipe de Mello pequeno', 'Tiago da Silva',
  'Pablo', 'Sebastiani', 'Padovani', 'Mello pequeno'];

const FORBIDDEN_KEYS = ['match', 'score', 'owner_id', 'user_id', 'phone', 'telefone', 'email', 'contact_snapshot', 'raw_description',
  'description', 'latitude', 'longitude', 'lat', 'lng', 'address', 'is_legacy', 'id'];
const ALLOWED_ITEM_KEYS = ['can_report_found', 'category', 'category_label', 'code', 'created_at', 'has_photo', 'location_label',
  'origin', 'photo_url', 'source_name', 'source_url', 'status', 'status_label', 'title'];

function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); allKeys(x, out); }
  return out;
}

describe('máscara de nome de pessoa', () => {
  it('mascara «em nome de <nome completo>» (caso real dos sinais públicos)', () => {
    const t = maskPersonNames('Documento encontrado em nome de Pablo Miguel Ferreira de Melo Sebastiani');
    expect(t).toBe(`Documento encontrado em nome de ${MASK_PLACEHOLDER}`);
  });
  it('mascara nome com minúsculas no fim e com iniciais', () => {
    expect(maskPersonNames('Documento encontrado em nome de Filipe de Mello pequeno')).not.toMatch(/Filipe|Mello|pequeno/);
    expect(maskPersonNames('Encontrado RG em nome de J. Silva Junior')).not.toMatch(/Silva|Junior/);
  });
  it('mantém o resto da frase quando há vírgula', () => {
    const t = maskPersonNames('Cartão em nome de Maria Souza, no bairro Centro');
    expect(t).toBe(`Cartão em nome de ${MASK_PLACEHOLDER}, no bairro Centro`);
  });
  it('outras formas de titularidade', () => {
    expect(maskPersonNames('CNH de Carlos Eduardo Lima encontrada')).not.toMatch(/Carlos|Lima/);
    expect(maskPersonNames('Carteira pertencente a Ana Paula Souza')).not.toMatch(/Ana|Souza/);
    expect(maskPersonNames('Celular de propriedade de Roberto Dias')).not.toMatch(/Roberto|Dias/);
  });
  it('não estraga títulos sem nome de pessoa', () => {
    for (const t of ['Gato Derick desapareceu', 'Perda de óculos no Terminal Sul', 'Carteira de Trabalho Digital encontrada', 'Documento encontrado no Centro'])
      expect(maskPersonNames(t)).toBe(t);
  });
  it('aceita vazio/nulo', () => { expect(maskPersonNames(null)).toBe(''); expect(maskPersonNames(undefined)).toBe(''); });
});

describe('categorias', () => {
  it('agrupa pet e animal', () => { expect(feedCategoryKey('animal')).toBe('pet'); expect(feedCategoryKey('pet')).toBe('pet'); });
  it('categorias sujas viram «Outros» só na tela', () => {
    for (const c of ['found', 'lost', '', null, undefined, 'xyz', 'book']) expect(FEED_CATEGORY_LABELS[feedCategoryKey(c as string)]).toBe('Outros');
  });
});

describe('local (nunca rua, número ou CEP)', () => {
  it('remove rua/número/CEP/país e mantém bairro e cidade', () => {
    expect(parseLocation('Travessa do Cruzeiro 39, Parque Dos Pássaros, Santo André - SP').label).toBe('Parque Dos Pássaros, Santo André - SP');
    expect(parseLocation('Boa Viagem, 51021, Recife, Pernambuco, Brasil').label).toBe('Boa Viagem, Recife - PE');
    expect(parseLocation('Avenida Paulista 1000, Bela Vista, São Paulo, SP').label).toBe('Bela Vista, São Paulo - SP');
    expect(parseLocation('bairro Colonial, Cascavel, PR').label).toBe('Colonial, Cascavel - PR');
  });
  it('sem local utilizável → «Local não informado»', () => {
    for (const t of [null, '', 'Rua das Flores 123', '{"x":1}']) expect(parseLocation(t as string).label).toBe(NO_LOCATION_LABEL);
  });
  it('lê JSON em objects.location sem vazar coordenadas', () => {
    expect(parseLocation('{"lat":1,"lng":2,"address":"Centro, Cascavel, PR"}').label).toBe('Centro, Cascavel - PR');
  });
  it('cidade por coordenada só dentro do raio', () => {
    const m = [{ name: 'Cascavel', state_code: 'PR', latitude: -24.9555, longitude: -53.4552, radius_km: 15 }];
    expect(cityFromCoordinates(-24.96, -53.46, m)?.name).toBe('Cascavel');
    expect(cityFromCoordinates(-23.55, -46.63, m)).toBeNull();
  });
  it('faixas: mesma cidade = 0, mesmo estado = 1, outra região = fora', () => {
    const v = { cityNorm: 'cascavel', uf: 'PR', scope: 'estado' as const };
    expect(bandFor({ cityNorm: 'cascavel', singleNorm: null, uf: 'PR' }, v)).toBe(0);
    expect(bandFor({ cityNorm: 'toledo', singleNorm: null, uf: 'PR' }, v)).toBe(1);
    expect(bandFor({ cityNorm: 'recife', singleNorm: null, uf: 'PE' }, v)).toBeNull();
    expect(bandFor({ cityNorm: null, singleNorm: null, uf: null }, v)).toBeNull();
    expect(bandFor({ cityNorm: 'toledo', singleNorm: null, uf: 'PR' }, { ...v, scope: 'cidade' })).toBeNull();
  });
});

describe('ordem por faixas', () => {
  const mk = (code: string, o: Partial<Rankable>): Rankable => ({ code, origin: 'usuario', hasPhoto: false, createdAtMs: 1000, boosted: false, band: 0, ...o });
  it('boost, faixa, usuário antes de sinal, foto antes de sem foto, mais recente, código', () => {
    const r = rankFeed([
      mk('s-foto', { origin: 'sinal_publico', hasPhoto: true, createdAtMs: 9000 }),
      mk('u-semfoto-novo', { createdAtMs: 8000 }),
      mk('u-foto-velho', { hasPhoto: true, createdAtMs: 100 }),
      mk('u-semfoto-velho', { createdAtMs: 50 }),
      mk('b1-user', { band: 1, hasPhoto: true, createdAtMs: 99999 }),
      mk('boost', { boosted: true, band: 1, origin: 'sinal_publico' }),
    ]).map((x) => x.code);
    expect(r).toEqual(['boost', 'u-foto-velho', 'u-semfoto-novo', 'u-semfoto-velho', 's-foto', 'b1-user']);
  });
  it('teto de sinais públicos: nunca mais de 1 a cada 3 enquanto houver usuário na faixa', () => {
    const items: Rankable[] = [];
    for (let i = 0; i < 40; i++) items.push(mk(`s${i}`, { origin: 'sinal_publico', createdAtMs: 5000 + i }));
    for (let i = 0; i < 7; i++) items.push(mk(`u${i}`, { createdAtMs: i }));
    for (let i = 0; i < 5; i++) items.push(mk(`x${i}`, { band: 1, createdAtMs: i }));
    const r = rankFeed(items);
    expect(signalCapHolds(r)).toBe(true);
    expect(r.slice(0, 7).every((x) => x.origin === 'usuario')).toBe(true);
  });
  it('é estável e reproduzível (mesma entrada, mesma ordem, em qualquer ordem de chegada)', () => {
    const a = [mk('a', {}), mk('b', {}), mk('c', {})];
    expect(rankFeed(a).map((x) => x.code)).toEqual(rankFeed([...a].reverse()).map((x) => x.code));
  });
});

describe('tempo relativo e cursor', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  it('usa a data real e nunca sugere ao vivo', () => {
    expect(relativeTimeLabel('2026-11-12T11:40:00Z', now)).toBe('há menos de 1 hora');
    expect(relativeTimeLabel('2026-11-12T09:00:00Z', now)).toBe('há 3 horas');
    expect(relativeTimeLabel('2026-11-10T12:00:00Z', now)).toBe('há 2 dias');
    expect(relativeTimeLabel('2026-08-12T12:00:00Z', now)).toBe('há 3 meses');
    expect(relativeTimeLabel('2024-11-12T12:00:00Z', now)).toBe('há 2 anos');
    for (const iso of ['2026-11-12T11:59:59Z', '2026-11-12T12:00:00Z']) expect(relativeTimeLabel(iso, now)).not.toMatch(/agora|instante|ao vivo/i);
  });
  it('cursor opaco: ida e volta, e lixo é recusado', () => {
    expect(decodeCursor(encodeCursor(5, 'ABC123'))).toEqual({ p: 5, c: 'ABC123' });
    for (const bad of ['', 'xxx', Buffer.from('{"p":-1,"c":"a"}').toString('base64url'), Buffer.from('{"p":1}').toString('base64url'), 'a'.repeat(300)])
      expect(decodeCursor(bad)).toBeNull();
  });
});

// ─── Integração com Postgres real ────────────────────────────────────────────────────────────────
describe.skipIf(!TEST_DB)('Feed com banco real', () => {
  let pool: Pool;
  let q: typeof import('@/lib/feed/query');
  let GET: (r: NextRequest) => Promise<Response>;

  const reset = async () => {
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-schema.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(__dirname, 'fixtures/feed-seed.sql'), 'utf8'));
    q.resetFeedCache();
  };
  const api = async (qs = '') => {
    const res = await GET(new NextRequest(`http://localhost/api/v1/feed${qs}`));
    return { res, body: await res.json() };
  };
  const all = async (params = {}) => (await q.getRankedFeed(params)).items;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    q = await import('@/lib/feed/query');
    ({ GET } = await import('@/app/api/v1/feed/route'));
  });
  beforeEach(reset);
  afterAll(async () => { await pool?.end(); });

  it('NUNCA mostra legado, arquivado, devolvido, protegido nem objeto não público', async () => {
    const codes = (await all()).map((i) => i.code);
    expect(codes.length).toBe(20); // 8 usuários + 12 sinais
    expect(codes.some((c) => c.startsWith('LEG'))).toBe(false);
    for (const c of ['PRV00001', 'ARC00001', 'RET00001', 'PRO00001']) expect(codes).not.toContain(c);
    // os filtros de situação também não deixam o legado entrar
    for (const s of ['lost', 'found', 'stolen']) expect((await all({ status: s })).some((i) => i.code.startsWith('LEG'))).toBe(false);
  });

  it('o legado continua intacto no banco (o Feed não altera nada)', async () => {
    const before = (await pool.query('SELECT count(*)::int n, md5(string_agg(id::text||title||status||is_public::text, \',\' ORDER BY id)) h FROM objects')).rows[0];
    await all(); await api('?status=found');
    const after = (await pool.query('SELECT count(*)::int n, md5(string_agg(id::text||title||status||is_public::text, \',\' ORDER BY id)) h FROM objects')).rows[0];
    expect(after).toEqual(before);
    expect((await pool.query('SELECT count(*)::int n FROM objects WHERE is_legacy AND is_public')).rows[0].n).toBe(40);
  });

  it('resposta da API: campos fixos, nenhum campo proibido, sem total', async () => {
    const { res, body } = await api('?limit=30');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=300/);
    expect(res.headers.get('cache-control')).not.toMatch(/no-store/);
    const keys = allKeys(body);
    for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `campo proibido: ${k}`).toBe(false);
    for (const it of body.items) expect(Object.keys(it).sort()).toEqual(ALLOWED_ITEM_KEYS);
    expect(keys.has('total')).toBe(false);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/45999990000|contato@exemplo|contact_snapshot/); // telefone/e-mail do contact_snapshot do sinal
  });

  it('nome de pessoa mascarado na API', async () => {
    const raw = JSON.stringify((await api('?limit=30')).body);
    for (const n of NAMES) expect(raw).not.toContain(n);
    expect(raw).toContain('em nome de (nome omitido)');
  });

  it('nome de pessoa mascarado no HTML renderizado pelo servidor (página /feed)', async () => {
    const { default: FeedPage } = await import('@/app/feed/[[...slug]]/page');
    const html = renderToString(await FeedPage({ params: {} }));
    for (const n of NAMES) expect(html).not.toContain(n);
    expect(html).toContain('Feed de ocorrências');
    // os sinais com nome são os mais antigos: aparecem na página 2 (links «Ver mais», também sem JavaScript)
    const html2 = renderToString(await FeedPage({ params: { slug: ['pagina', '2'] } }));
    for (const n of NAMES) expect(html2).not.toContain(n);
    expect(html2).toContain('em nome de (nome omitido)');
  });

  it('HTML inicial já traz os cards e links rastreáveis (sem JavaScript)', async () => {
    const { default: FeedPage } = await import('@/app/feed/[[...slug]]/page');
    const html = renderToString(await FeedPage({ params: {} }));
    expect((html.match(/<article/g) ?? []).length).toBe(q.FEED_PAGE_SIZE);
    expect(html).toMatch(/<h1[^>]*>Feed de ocorrências<\/h1>/);
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toMatch(/href="\/objeto\/USR0000\d"[^>]*>[^<]+<\/a>/); // texto útil = título
    expect(html).toContain('href="/feed/pagina/2"');                    // «Ver mais» real
    expect(html).toContain('href="/map"');                              // Ver histórico no mapa
    expect(html).not.toMatch(/Seguir|Curtir|Comentar|SMS|QR/i);
  });

  it('ações por tipo: «Informar que encontrei» só em usuário perdido/roubado; sinal público marcado com origem', async () => {
    const items = await all();
    for (const i of items) {
      expect(i.can_report_found).toBe(i.origin === 'usuario' && (i.status === 'lost' || i.status === 'stolen'));
      if (i.origin === 'sinal_publico') { expect(i.can_report_found).toBe(false); expect(i.source_url).toMatch(/^https:\/\/g1\.globo\.com/); }
      else expect(i.source_url).toBeNull();
    }
    const { default: FeedPage } = await import('@/app/feed/[[...slug]]/page');
    const html = renderToString(await FeedPage({ params: {} }));
    expect(html).toContain('href="/achei?ref=feed"');
    expect(html).toContain('Origem: notícia pública');
    // nenhum sinal público com o botão
    const articles = html.split('<article').slice(1);
    for (const a of articles) if (a.includes('data-origin="sinal_publico"')) expect(a).not.toContain('Informar que encontrei');
  });

  it('ordem: usuários antes de sinais; foto antes de sem foto; mais recente primeiro', async () => {
    const items = await all();
    const firstSignal = items.findIndex((i) => i.origin === 'sinal_publico');
    expect(items.slice(0, firstSignal).every((i) => i.origin === 'usuario')).toBe(true);
    expect(items.slice(firstSignal).every((i) => i.origin === 'sinal_publico')).toBe(true);
    const users = items.slice(0, firstSignal);
    const firstNoPhoto = users.findIndex((i) => !i.has_photo);
    expect(users.slice(firstNoPhoto).every((i) => !i.has_photo)).toBe(true);
    const sigs = items.slice(firstSignal);
    for (let i = 1; i < sigs.length; i++) expect(Date.parse(sigs[i - 1].created_at)).toBeGreaterThanOrEqual(Date.parse(sigs[i].created_at));
  });

  it('visitante em Cascavel/PR: só mesma cidade e mesmo estado; nada de outras regiões', async () => {
    const r = await q.getRankedFeed({ city: 'Cascavel', uf: 'PR' });
    expect(r.locationApplied).toBe(true);
    const codes = r.items.map((i) => i.code);
    for (const c of ['USR00001', 'USR00002', 'USR00005', 'USR00007', 'USR00008', 'SIG00005', 'SIG00008', 'SIG00011', 'SIG00012']) expect(codes, c).not.toContain(c);
    for (const c of ['USR00003', 'USR00004', 'SIG00001', 'SIG00007']) expect(codes, c).toContain(c); // 7 = «Parque Verde», cidade pela coordenada
    // usuário de Cascavel (faixa 0) antes de qualquer sinal
    expect(r.items[0].origin).toBe('usuario');
    expect((await q.getRankedFeed({ city: 'Cascavel', uf: 'PR', scope: 'cidade' })).items.length).toBe(codes.length); // tudo é Cascavel nos dados
  });

  it('região sem ocorrências → lista vazia (nunca preenche com outras regiões)', async () => {
    expect((await all({ uf: 'AM' })).length).toBe(0);
    expect((await all({ city: 'Manaus', uf: 'AM' })).length).toBe(0);
    const { body } = await api('?cidade=Manaus&uf=AM');
    expect(body.items).toEqual([]);
    expect(body.meta.location_applied).toBe(true);
  });

  it('parâmetros hostis são ignorados ou recusados, sem erro de banco', async () => {
    for (const qs of ["?status=x';drop table objects;--", '?categoria=../../etc', '?cidade=' + 'a'.repeat(500), '?uf=ZZ', '?limit=-5', '?limit=abc']) {
      const { res } = await api(qs); expect(res.status).toBe(200);
    }
    expect((await api('?cursor=lixo')).res.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int n FROM objects')).rows[0].n).toBeGreaterThan(0);
  });

  it('filtros: situação e categoria (pet+animal juntos; categoria suja = Outros)', async () => {
    expect((await all({ status: 'lost' })).every((i) => i.status === 'lost')).toBe(true);
    const pets = await all({ category: 'pet' });
    expect(pets.length).toBeGreaterThan(0);
    expect(pets.every((i) => i.category === 'pet' && i.category_label === 'Pet')).toBe(true);
    expect(pets.map((i) => i.code)).toEqual(expect.arrayContaining(['USR00003', 'USR00004', 'SIG00004', 'SIG00009'])); // animal + pet
    const outros = await all({ category: 'other' });
    expect(outros.map((i) => i.code)).toContain('USR00005'); // categoria «found» no banco
    expect((await pool.query("SELECT category FROM objects WHERE qr_code='USR00005'")).rows[0].category).toBe('found'); // dado intocado
  });

  it('foto inline (base64) nunca vai para a resposta; sem foto vira bloco por categoria', async () => {
    const it = (await all()).find((i) => i.code === 'USR00007')!;
    expect(it.photo_url).toBeNull(); expect(it.has_photo).toBe(false);
    const raw = JSON.stringify((await api('?limit=30')).body);
    expect(raw).not.toContain('/9j/4AAQ');
    expect(raw.length).toBeLessThan(40_000);
  });

  it('paginação por cursor: percorre tudo, sem repetir e sem cortar', async () => {
    const seen: string[] = []; let cursor: string | null = null; let pages = 0;
    do {
      const { body } = await api(`?limit=7${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...body.items.map((i: { code: string }) => i.code)); cursor = body.next_cursor; pages++;
    } while (cursor && pages < 20);
    expect(seen.length).toBe(20);
    expect(new Set(seen).size).toBe(20);
    expect(seen).toEqual((await all()).map((i) => i.code));
  });

  it('cursor sobrevive a um cadastro novo entre duas páginas (não repete nem pula)', async () => {
    const p1 = (await api('?limit=6')).body;
    await pool.query("INSERT INTO objects (title,status,category,qr_code,is_public,is_legacy,created_at,images) VALUES ('Novo agora','lost','phone','NEW00001',true,false,now(),'[\"https://pub-test.r2.dev/n.jpg\"]')");
    q.resetFeedCache();
    const p2 = (await api(`?limit=6&cursor=${p1.next_cursor}`)).body;
    const a = p1.items.map((i: { code: string }) => i.code), b = p2.items.map((i: { code: string }) => i.code);
    expect(a.filter((c: string) => b.includes(c))).toEqual([]);
    expect(b.length).toBe(6);
  });

  it('páginas numeradas cobrem tudo e a página além do fim é 404', async () => {
    const { default: FeedPage } = await import('@/app/feed/[[...slug]]/page');
    const codes = new Set<string>();
    for (const slug of [undefined, ['pagina', '2']]) {
      const html = renderToString(await FeedPage({ params: { slug } }));
      for (const m of html.matchAll(/data-origin="[a-z_]+"/g)) codes.add(m[0]);
    }
    await expect(FeedPage({ params: { slug: ['pagina', '9'] } })).rejects.toThrow(); // notFound()
    await expect(FeedPage({ params: { slug: ['pagina', '1'] } })).rejects.toThrow();
    await expect(FeedPage({ params: { slug: ['x'] } })).rejects.toThrow();
  });

  it('boost ativo vai ao topo; boost vencido não', async () => {
    await pool.query("UPDATE objects SET is_boosted=true, boost_expires_at=now()+interval '1 day' WHERE qr_code='SIG00012'");
    q.resetFeedCache();
    expect((await all())[0].code).toBe('SIG00012');
    await pool.query("UPDATE objects SET boost_expires_at=now()-interval '1 day' WHERE qr_code='SIG00012'");
    q.resetFeedCache();
    expect((await all())[0].code).not.toBe('SIG00012');
  });

  it('teto de leitura: acima do limite a resposta SINALIZA o corte (nada é cortado em silêncio)', async () => {
    await pool.query(`INSERT INTO objects (title,status,category,qr_code,is_public,is_legacy,created_at)
      SELECT 'Massa '||g,'lost','other','MAS'||g,true,false,'2026-01-01'::timestamp + g*interval '1 minute' FROM generate_series(1,1005) g`);
    q.resetFeedCache();
    const r = await q.getRankedFeed({});
    expect(r.truncated).toBe(true);
    expect(r.items.length).toBe(q.FEED_MAX_CANDIDATES);
    expect((await api('?limit=1')).body.meta.truncated).toBe(true);
  });

  it('sem ocorrência pública, a API responde 200 com lista vazia (não 401, não erro)', async () => {
    await pool.query('UPDATE objects SET is_public=false');
    q.resetFeedCache();
    const { res, body } = await api();
    expect(res.status).toBe(200); expect(body.items).toEqual([]); expect(body.has_more).toBe(false);
  });
});
