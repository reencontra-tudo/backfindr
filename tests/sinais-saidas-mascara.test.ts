// Saídas que vazavam o nome de SINAIS PÚBLICOS agora passam pela máscara central: API de leitura por código, mapa, GET /matches, e-mail de match,
// página /scan. Usuário e legado saem IDÊNTICOS; o título gravado continua o original e a busca/casamento seguem usando o original (decisão da lista pública).
// Banco simulado. Nomes e endereços inventados.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import * as ReactNS from 'react';
(globalThis as { React?: unknown }).React = ReactNS;

const st = vi.hoisted(() => { process.env.SECRET_KEY = process.env.SECRET_KEY || 'chave-de-teste-nao-real-0123456789'; return { scan: [] as Record<string, unknown>[], mapa: [] as Record<string, unknown>[], matches: [] as Record<string, unknown>[], emails: [] as { subject: string; html: string }[] }; });
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('legacy_blocked')) return { rows: st.scan };
    if (sql.includes('FROM matches m')) return { rows: st.matches };
    if (sql.includes("status = 'returned'")) return { rows: [{ count: 0 }] };
    if (sql.includes('FROM objects')) return { rows: st.mapa };
    return { rows: [] };
  }),
}));
vi.mock('@/lib/emailSend', async (orig) => ({ ...(await orig<Record<string, unknown>>()), deliverEmail: vi.fn(async (o: { subject: string; html: string }) => { st.emails.push(o); return { ok: true }; }) }));

import { GET as porCodigo } from '@/app/api/v1/objects/scan/[code]/route';
import { GET as mapa } from '@/app/api/v1/objects/map/route';
import { GET as meusMatches } from '@/app/api/v1/matches/route';
import { createAccessToken } from '@/lib/jwt';
import { tituloPublico } from '@/lib/objectPublicView';
import { sendMatchAlertEmail } from '@/lib/email';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const NOME = 'Maria da Silva Santos';                                   // fictício
const TITULO_SINAL = `Documento encontrado em nome de ${NOME}`;
const DESC_SINAL = `${TITULO_SINAL}. Categoria: documento. Local: Centro, Cascavel. Ocorrência identificada automaticamente a partir de canal institucional. Fonte: https://exemplo.test/achados/documento-em-nome-de-maria-da-silva-santos`;
const base = (o: Record<string, unknown>) => ({ id: 'x1', title: 'Carteira marrom perdida', description: 'Carteira marrom perdida no ônibus.', status: 'found', category: 'document', type: 'document', location: 'Centro, Cascavel - PR',
  latitude: '-24.95', longitude: '-53.45', qr_code: 'COD-X', color: null, brand: null, breed: null, images: '[]', is_legacy: false, source: null, reward_amount: null, reward_description: null,
  created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z', legacy_blocked: false, ...o });
const SINAL = base({ id: 's1', source: 'public_signal', title: TITULO_SINAL, description: DESC_SINAL });
const USUARIO = base({ id: 'u1', title: `Documento em nome de ${NOME}`, description: `Achei o documento em nome de ${NOME}. Fonte: https://exemplo.test/x` });   // usuário escreveu: fica como está
const LEGADO = base({ id: 'l1', is_legacy: true, source: 'webjetos', title: `RG em nome de ${NOME}`, description: `RG em nome de ${NOME}` });
beforeEach(() => { st.scan = []; st.mapa = []; st.matches = []; st.emails = []; });

describe('API de leitura por código (/api/v1/objects/scan/<código>)', () => {
  const ler = async (row: Record<string, unknown>) => { st.scan = [row]; const j = await (await porCodigo(new NextRequest('http://localhost/x'), { params: { code: 'COD-X' } })).json(); return j.data ?? j; };
  it('sinal público: título, descrição e endereço sem o nome e sem o «Fonte: <endereço>»; o resto da resposta igual', async () => {
    const j = await ler(SINAL);
    expect(j.title).toBe('Documento encontrado em nome de (nome omitido)'); expect(JSON.stringify(j)).not.toMatch(/Maria|Silva|Santos|exemplo\.test/);
    expect(j.status).toBe('found'); expect(j.category).toBe('document'); expect(j.unique_code).toBe('COD-X'); expect(j.source).toBe('public_signal');
  });
  it('sinal com nome no endereço do local: o endereço também sai mascarado', async () => {
    const j = await ler({ ...SINAL, location: `RG em nome de ${NOME}` }); expect(JSON.stringify(j.location)).not.toMatch(/Maria|Santos/);
  });
  it('usuário e legado: idênticos (o texto que a pessoa escreveu não é tocado)', async () => {
    const u = await ler(USUARIO); expect(u.title).toBe(USUARIO.title); expect(u.description).toBe(USUARIO.description);
    const l = await ler(LEGADO); expect(l.title).toBe(LEGADO.title); expect(l.description).toBe(LEGADO.description);
  });
});

describe('mapa (/api/v1/objects/map)', () => {
  it('sinal público sem o nome; usuário e legado idênticos; os campos do pin não mudam', async () => {
    st.mapa = [{ id: 's1', title: TITULO_SINAL, status: 'found', category: 'document', latitude: '-24.95', longitude: '-53.45', location: 'Centro', is_legacy: false, source: 'public_signal' },
      { id: 'u1', title: USUARIO.title, status: 'found', category: 'document', latitude: '-24.95', longitude: '-53.45', location: 'Centro', is_legacy: false, source: null },
      { id: 'l1', title: LEGADO.title, status: 'found', category: 'document', latitude: '-24.95', longitude: '-53.45', location: 'Centro', is_legacy: true, source: 'webjetos' }];
    const j = await (await mapa()).json(); const por = (id: string) => j.items.find((i: { id: string }) => i.id === id);
    expect(por('s1').title).toBe('Documento encontrado em nome de (nome omitido)'); expect(por('u1').title).toBe(USUARIO.title); expect(por('l1').title).toBe(LEGADO.title);
    expect(Object.keys(por('s1')).sort()).toEqual(['category', 'id', 'location', 'status', 'title']); expect(JSON.stringify(por('s1'))).not.toContain('Maria');   // só o sinal muda
  });
});

describe('GET /api/v1/matches (o que o dono do objeto perdido vê)', () => {
  const linha = (o: Record<string, unknown>) => ({ id: 'm1', lost_object_id: 'a', found_object_id: 'b', score: 80, status: 'pending', created_at: 't', updated_at: 't', lost_title: 'Meu documento perdido', lost_description: 'perdi', found_title: TITULO_SINAL, found_description: DESC_SINAL, _lost_source: null, _found_source: 'public_signal', ...o });
  const chamar = async () => (await meusMatches(new NextRequest('http://localhost/api/v1/matches', { headers: { authorization: `Bearer ${createAccessToken('u-dono', 'dono@teste.local')}` } }))).json();
  it('objeto de sinal sai mascarado (título e descrição); as colunas auxiliares não vão na resposta', async () => {
    st.matches = [linha({})]; const j = await chamar(); const m = j.matches[0];
    expect(m.found_title).toBe('Documento encontrado em nome de (nome omitido)'); expect(m.found_description).not.toMatch(/Maria|Silva|exemplo\.test/); expect(m.lost_title).toBe('Meu documento perdido');
    expect(Object.keys(m).sort()).toEqual(['created_at', 'found_description', 'found_object_id', 'found_title', 'id', 'lost_description', 'lost_object_id', 'lost_title', 'score', 'status', 'updated_at']);
    expect(j.total).toBe(1);
  });
  it('usuário e legado: idênticos aos de antes', async () => {
    st.matches = [linha({ found_title: USUARIO.title, found_description: USUARIO.description, _found_source: null }), linha({ id: 'm2', found_title: LEGADO.title, found_description: LEGADO.description, _found_source: 'webjetos' })];
    const j = await chamar(); expect(j.matches[0].found_title).toBe(USUARIO.title); expect(j.matches[0].found_description).toBe(USUARIO.description); expect(j.matches[1].found_title).toBe(LEGADO.title);
  });
  it('sinal perdido (lado «perdido» do match) também é mascarado', async () => {
    st.matches = [linha({ lost_title: TITULO_SINAL, lost_description: DESC_SINAL, _lost_source: 'public_signal', found_title: 'Meu achado', found_description: 'x', _found_source: null })];
    const m = (await chamar()).matches[0]; expect(m.lost_title).toBe('Documento encontrado em nome de (nome omitido)'); expect(m.found_title).toBe('Meu achado');
  });
});

describe('e-mail de alerta de match', () => {
  it('tituloPublico: sinal mascarado; usuário, legado, vazio e sem origem ficam como estão', () => {
    expect(tituloPublico(TITULO_SINAL, 'public_signal')).toBe('Documento encontrado em nome de (nome omitido)');
    for (const src of [null, undefined, 'webjetos', 'user']) expect(tituloPublico(TITULO_SINAL, src)).toBe(TITULO_SINAL);
    expect(tituloPublico('', 'public_signal')).toBe(''); expect(tituloPublico(null, 'public_signal')).toBeNull();
  });
  it('o e-mail montado com o título do sinal não leva o nome; o de usuário leva o texto dele', async () => {
    await sendMatchAlertEmail({ name: 'Dono Teste', email: 'dono@teste.local' }, 'Meu documento', 'm1', 80, tituloPublico(TITULO_SINAL, 'public_signal') as string);
    expect(st.emails[0].html).not.toContain(NOME); expect(st.emails[0].html).toContain('(nome omitido)');
    await sendMatchAlertEmail({ name: 'Dono Teste', email: 'dono@teste.local' }, 'Meu documento', 'm2', 80, tituloPublico(USUARIO.title, null) as string);
    expect(st.emails[1].html).toContain(NOME);
  });
  it('os dois pontos que mandam o e-mail (matching/run e cron/matching) usam o título público do candidato e do objeto', () => {
    for (const f of ['src/app/api/v1/matching/run/route.ts', 'src/app/api/v1/cron/matching/route.ts']) {
      const c = read(f); expect(c, f).toContain("import { tituloPublico } from '@/lib/objectPublicView'"); expect(c, f).toMatch(/tituloPublico\(\w+\.title as string, \w+\.source as string \| null\)/g);
      expect((c.match(/tituloPublico\(/g) ?? []).length, f).toBe(2);
    }
  });
});

describe('página /scan (título e meta do QR)', () => {
  it('mesmo quando a API consultada (outra versão, ex.: produção na prévia) devolve o nome, a página entrega mascarado', async () => {
    const mod = await import('@/app/scan/[code]/page');
    const antes = globalThis.fetch; globalThis.fetch = (async () => new Response(JSON.stringify({ ...SINAL, unique_code: 'COD-X', photos: [], location: { lat: -24.95, lng: -53.45, address: `RG em nome de ${NOME}` } }), { status: 200 })) as typeof fetch;
    try {
      const meta = await mod.generateMetadata({ params: { code: 'COD-X' } });
      expect(JSON.stringify(meta)).not.toMatch(/Maria|Silva|Santos|exemplo\.test/); expect(JSON.stringify(meta)).toContain('(nome omitido)');
      globalThis.fetch = (async () => new Response(JSON.stringify({ ...USUARIO, unique_code: 'COD-X', photos: [], location: null }), { status: 200 })) as typeof fetch;
      expect(JSON.stringify(await mod.generateMetadata({ params: { code: 'COD-X' } }))).toContain(NOME);                 // usuário: igual a antes
    } finally { globalThis.fetch = antes; }
  });
});

describe('o que NÃO mudou (decisão da lista pública: busca e casamento usam o original)', () => {
  it('o título gravado não é mascarado: aprovação, ingestão e envio manual gravam o original; nenhum caminho de gravação usa a máscara', () => {
    for (const f of ['src/app/api/v1/admin/public-signals/route.ts', 'src/app/api/v1/admin/public-signals/ingest/route.ts', 'src/app/api/v1/admin/public-signals/submit/route.ts']) expect(read(f), f).not.toMatch(/maskPersonNames|tituloPublico|maskSignalForPublicApi/);
    expect(read('src/app/api/v1/admin/public-signals/route.ts')).toContain('        fields.title,\n');
  });
  it('matching e busca não importam a máscara: o casamento, a pontuação e o texto enviado ao modelo semântico seguem no original', () => {
    for (const f of ['src/lib/matching.ts', 'src/app/api/v1/objects/public/route.ts']) expect(read(f), f).not.toMatch(/tituloPublico|maskPersonNames/);
    expect(read('src/lib/matching.ts')).toContain('Título: ${obj.title}');
    expect(read('src/app/api/v1/objects/public/route.ts')).toContain('calcularScoreBusca(keyword, row, opcoes)');
  });
  it('rotas de administrador ficam como estão', () => {
    for (const f of ['src/app/api/v1/admin/matches/route.ts', 'src/app/api/v1/admin/objects/route.ts', 'src/app/api/v1/admin/reports/export/route.ts']) expect(read(f), f).not.toMatch(/tituloPublico|maskSignalForPublicApi/);
  });
  it('stats/public: só objetos devolvidos (sinal público nunca é «devolvido»; não se aplica)', () => {
    expect(read('src/app/api/v1/stats/public/route.ts')).toContain("WHERE status = 'returned'");
  });
});
