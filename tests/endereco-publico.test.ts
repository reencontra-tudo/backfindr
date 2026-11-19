// Endereço público só com «bairro, cidade - UF» (mesma redução do Feed) nas saídas públicas, só para cadastros de USUÁRIO. Legado e sinal público: idênticos.
// Casamento, pontuação, ordem e ids continuam pelo texto ORIGINAL; o dono segue vendo o endereço completo. Nomes e endereços inventados. Banco simulado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const st = vi.hoisted(() => { process.env.SECRET_KEY = process.env.SECRET_KEY || 'chave-de-teste-nao-real-0123456789'; return { rows: [] as Record<string, unknown>[], recentes: [] as Record<string, unknown>[], dono: [] as Record<string, unknown>[], scan: [] as Record<string, unknown>[] }; });
vi.mock('@/lib/db', () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes('information_schema')) return { rows: [] };
    if (sql.includes('INTERVAL')) return { rows: st.recentes };
    if (sql.includes('user_id = $2')) return { rows: st.dono };            // leitura do dono (/api/v1/objects/[id])
    if (sql.includes('legacy_blocked')) return { rows: st.scan };           // leitura por código (/api/v1/objects/scan/[code])
    return { rows: st.rows };
  }),
}));

import { GET as publica } from '@/app/api/v1/objects/public/route';
import { GET as porCodigo } from '@/app/api/v1/objects/scan/[code]/route';
import { GET as doDono } from '@/app/api/v1/objects/[id]/route';
import { createAccessToken } from '@/lib/jwt';
import { buscarRegistrosRecentesParecidos } from '@/lib/flowMatch/recentSimilar';
import { enderecoPublico, localizacaoPublica, ehCadastroDeUsuario } from '@/lib/publicLocation';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const RUA = 'Rua das Palmeiras Fictícias 1224, Vila Modelo, Guarulhos - SP, 07040-000';
const row = (o: Record<string, unknown>) => ({
  id: 'id-x', title: 'Carteira marrom perdida', description: 'Carteira marrom perdida no ônibus.', status: 'lost', category: 'wallet', type: 'wallet',
  location: RUA, latitude: '-23.45', longitude: '-46.52', qr_code: 'COD-X', color: null, brand: null, breed: null, images: '[]',
  is_legacy: false, source: null, reward_amount: null, reward_description: null, is_boosted: false, boost_expires_at: null,
  created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z', ...o,
});
const USUARIO = row({ id: 'u1', qr_code: 'U1' });
const USUARIO_SEM_RUA = row({ id: 'u2', qr_code: 'U2', location: 'Centro, Cascavel, PR', title: 'Carteira preta perdida', description: 'Carteira preta.' });
const USUARIO_SO_RUA = row({ id: 'u3', qr_code: 'U3', location: 'Rua Sem Cidade 10', title: 'Carteira azul perdida', description: 'Carteira azul.' });
const LEGADO = row({ id: 'l1', qr_code: 'L1', is_legacy: true, source: 'webjetos', location: 'Rua do Legado, 55 - Centro, São Paulo', title: 'Carteira legado', description: 'Carteira.' });
const SINAL = row({ id: 's1', qr_code: 'S1', source: 'public_signal', location: 'bairro Colonial, Cascavel, PR', title: 'Carteira encontrada', description: 'Carteira encontrada. Categoria: carteira.', status: 'found' });
const call = async (qs: string) => (await publica(new NextRequest(`http://localhost/api/v1/objects/public?${qs}`))).json();

beforeEach(() => { st.rows = [USUARIO, USUARIO_SEM_RUA, USUARIO_SO_RUA, LEGADO, SINAL]; st.recentes = []; st.dono = []; st.scan = []; });

describe('função: «bairro, cidade - UF» só para usuário', () => {
  it('usuário com logradouro, número e CEP: sai só «bairro, cidade - UF»', () => {
    const r = enderecoPublico(RUA, { is_legacy: false, source: null });
    expect(r).toBe('Vila Modelo, Guarulhos - SP'); expect(r).not.toMatch(/Rua|Palmeiras|1224|07040/);
  });
  it('usuário sem rua: mesma redução do Feed; só rua (sem bairro/cidade): nada (a tela omite); vazio/ausente: igual a hoje', () => {
    expect(enderecoPublico('Centro, Cascavel, PR', { source: null })).toBe('Centro, Cascavel - PR');
    expect(enderecoPublico('Rua Sem Cidade 10', { source: null })).toBeUndefined();
    expect(enderecoPublico('', { source: null })).toBe(''); expect(enderecoPublico(undefined, { source: null })).toBeUndefined();
  });
  it('legado e sinal público: devolve o MESMO texto (nem uma letra muda)', () => {
    for (const t of [RUA, 'Rua do Legado, 55 - Centro, São Paulo', 'bairro Colonial, Cascavel, PR', 'x', '{"a":1}']) {
      expect(enderecoPublico(t, { is_legacy: true, source: 'webjetos' })).toBe(t);
      expect(enderecoPublico(t, { is_legacy: false, source: 'public_signal' })).toBe(t);
    }
    expect(ehCadastroDeUsuario({ is_legacy: true })).toBe(false); expect(ehCadastroDeUsuario({ source: 'public_signal' })).toBe(false); expect(ehCadastroDeUsuario({ is_legacy: false, source: null })).toBe(true);
  });
  it('coordenada pública com 3 casas só no usuário; legado/sinal intactos; o objeto de entrada não é alterado', () => {
    const entrada = { lat: -23.4567891, lng: -46.5234567, address: RUA };
    const saida = localizacaoPublica(entrada, { source: null });
    expect(saida).toEqual({ lat: -23.457, lng: -46.523, address: 'Vila Modelo, Guarulhos - SP' });   // coordenada pública: 3 casas (~110 m)
    expect(entrada.lat).toBe(-23.4567891); expect(entrada.address).toBe(RUA);
    expect(localizacaoPublica(null, { source: null })).toBeNull();
    expect(localizacaoPublica(entrada, { is_legacy: true })).toBe(entrada);              // legado: a mesma referência
  });
});

describe('/api/v1/objects/public', () => {
  it('usuário: endereço reduzido na resposta; coordenadas iguais; legado e sinal: idênticos aos do banco', async () => {
    const j = await call('size=50&status=all');
    const por = (id: string) => j.items.find((i: { id: string }) => i.id === id);
    expect(por('u1').location.address).toBe('Vila Modelo, Guarulhos - SP'); expect(por('u1').location.lat).toBeCloseTo(-23.45); expect(por('u1').location.lng).toBeCloseTo(-46.52);
    expect(por('u2').location.address).toBe('Centro, Cascavel - PR');
    expect(por('u3').location.address).toBeUndefined();
    expect(por('l1').location.address).toBe('Rua do Legado, 55 - Centro, São Paulo');
    expect(por('s1').location.address).toBe('bairro Colonial, Cascavel, PR');
    expect(JSON.stringify(j.items.filter((i: { id: string }) => i.id === 'u1'))).not.toMatch(/Palmeiras|1224|07040/);
  });
  it('casamento e pontuação pelo texto ORIGINAL: mesmos ids, mesma ordem e mesma pontuação que antes da redução', async () => {
    expect(read('src/app/api/v1/objects/public/route.ts')).toContain('calcularScoreBusca(keyword, row)');   // a pontuação lê a linha do banco, não o item reduzido
    const reduzida = await call('keyword=carteira%20marrom&size=50&status=all');
    vi.resetModules(); vi.doMock('@/lib/publicLocation', () => ({ enderecoPublico: (a: unknown) => a, localizacaoPublica: (l: unknown) => l, ehCadastroDeUsuario: () => false }));
    const { GET: antes } = await import('@/app/api/v1/objects/public/route');
    const original = await (await antes(new NextRequest('http://localhost/api/v1/objects/public?keyword=carteira%20marrom&size=50&status=all'))).json();
    vi.doUnmock('@/lib/publicLocation'); vi.resetModules();
    expect(reduzida.items.map((i: { id: string }) => i.id)).toEqual(original.items.map((i: { id: string }) => i.id));
    expect(reduzida.items.map((i: { _score: number }) => i._score)).toEqual(original.items.map((i: { _score: number }) => i._score));
    expect(reduzida.total).toBe(original.total); expect(reduzida.items.length).toBeGreaterThan(0);
    const r = reduzida.items.find((i: { id: string }) => i.id === 'u1'); const o = original.items.find((i: { id: string }) => i.id === 'u1');
    expect(o.location.address).toBe(RUA); expect(r.location.address).toBe('Vila Modelo, Guarulhos - SP');          // só o endereço de saída difere
  });
  it('o resto do item é idêntico ao de antes (só location.address muda)', async () => {
    const reduzida = await call('size=50&status=all');
    vi.resetModules(); vi.doMock('@/lib/publicLocation', () => ({ enderecoPublico: (a: unknown) => a, localizacaoPublica: (l: unknown) => l, ehCadastroDeUsuario: () => false }));
    const { GET: antes } = await import('@/app/api/v1/objects/public/route');
    const original = await (await antes(new NextRequest('http://localhost/api/v1/objects/public?size=50&status=all'))).json();
    vi.doUnmock('@/lib/publicLocation'); vi.resetModules();
    const semEndereco = (it: Record<string, unknown>) => { const { location, ...resto } = it as { location?: { lat?: number; lng?: number } } & Record<string, unknown>; return { ...resto, lat: location?.lat, lng: location?.lng }; };
    expect(reduzida.items.map(semEndereco)).toEqual(original.items.map(semEndereco));
  });
});

describe('/api/v1/objects/scan/[code] (QR, página do objeto, mapa, metadados)', () => {
  const chama = async () => (await porCodigo(new NextRequest('http://localhost/api/v1/objects/scan/U1'), { params: { code: 'U1' } })).json();
  it('usuário: endereço reduzido (tela, título/descrição para o Google e JSON-LD usam este campo)', async () => {
    st.scan = [{ ...USUARIO, legacy_blocked: false }];
    const j = await chama(); const loc = (j.data ?? j).location;
    expect(loc.address).toBe('Vila Modelo, Guarulhos - SP'); expect(JSON.stringify(j)).not.toMatch(/Palmeiras|1224|07040/);
  });
  it('legado e sinal público: endereço idêntico ao do banco', async () => {
    st.scan = [{ ...LEGADO, legacy_blocked: true }]; { const j = await chama(); expect((j.data ?? j).location.address).toBe('Rua do Legado, 55 - Centro, São Paulo'); }
    st.scan = [{ ...SINAL, legacy_blocked: false }]; { const j = await chama(); expect((j.data ?? j).location.address).toBe('bairro Colonial, Cascavel, PR'); }
  });
  it('a página do objeto, o mapa e a página de QR só repassam o endereço que vem desta rota (metadados e JSON-LD saem reduzidos)', () => {
    const p = read('src/app/objeto/[code]/page.tsx');
    expect(p).toContain('/api/v1/objects/scan/${code}'); expect(p).toContain('obj.location?.address'); expect(p).toContain('localizacaoPublica'); expect(p).not.toMatch(/location_addr|row\.location/);
    expect(read('src/app/scan/[code]/page.tsx')).toContain('/api/v1/objects/scan/${code}');
  });
});

describe('passo 2 dos fluxos (registros recentes parecidos)', () => {
  it('usuário: endereço reduzido; sinal público: como está', async () => {
    st.recentes = [row({ id: 'u1', qr_code: 'U1', title: 'Carteira marrom perdida', description: 'Carteira marrom perdida.' }), row({ id: 's1', qr_code: 'S1', source: 'public_signal', location: 'bairro Colonial, Cascavel, PR', title: 'Carteira marrom perdida', description: 'Carteira marrom perdida.' })];
    const r = await buscarRegistrosRecentesParecidos('carteira marrom', 'lost') as unknown as Array<{ id: string; location: { address?: string } | null }>;
    const u = r.find((i) => i.id === 'u1'); const s = r.find((i) => i.id === 's1');
    if (u) expect(u.location?.address).toBe('Vila Modelo, Guarulhos - SP');
    if (s) expect(s.location?.address).toBe('bairro Colonial, Cascavel, PR');
    expect(JSON.stringify(r)).not.toMatch(/Palmeiras|1224|07040/);
  });
});

describe('o DONO continua vendo o endereço completo (rotas e telas dele)', () => {
  it('GET /api/v1/objects/[id] (com login do dono) devolve o texto completo', async () => {
    st.dono = [{ ...USUARIO, user_id: 'dono-1' }];
    const token = createAccessToken('dono-1', 'dono@exemplo.com');
    const r = await doDono(new NextRequest('http://localhost/api/v1/objects/u1', { headers: { authorization: `Bearer ${token}` } }), { params: { id: 'u1' } });
    const j = await r.json(); expect(JSON.stringify(j)).toContain(RUA);
  });
  it('as rotas e telas do dono não usam a redução pública', () => {
    for (const f of ['src/app/api/v1/objects/[id]/route.ts', 'src/app/api/v1/objects/route.ts', 'src/app/dashboard/objects/[id]/page.tsx', 'src/app/dashboard/objects/[id]/edit/page.tsx', 'src/components/ui/LocationPicker.tsx'])
      expect(read(f), f).not.toMatch(/publicLocation|enderecoPublico|localizacaoPublica/);
  });
});

describe('cartaz NÃO foi alterado (o dono decide o que imprime)', () => {
  it('não usam a redução pública (continuam com o que usavam)', () => {
    expect(read('src/lib/posterFormatter.ts')).not.toMatch(/publicLocation|enderecoPublico|localizacaoPublica/);   // a prévia pública (?publico=1) é testada em cartaz-previa-publica.test.ts
    expect(read('src/lib/posterFormatter.ts')).toContain('const locationShort = clip(locationFull, 60)');
  });
});

describe('/achei: duas frases e o link «Ver detalhes»', () => {
  const c = read('src/app/achei/client.tsx');
  it('resultado vazio: sem «a gente conecta vocês»; texto sem promessa e com «gratuita»', () => {
    expect(c).not.toMatch(/a gente conecta|conecta vocês/i);
    expect(c).toContain('Crie uma conta gratuita para registrar o que você encontrou.');
    const bloco = c.slice(c.indexOf('Nenhum dono encontrado ainda'), c.indexOf('Registrar o que achei'));
    expect(bloco).not.toMatch(/protegid|SMS|chat|avis|respond|resposta|pre[çc]o|cobran|limite|plano|conecta/i);
  });
  it('«Ver detalhes» usa unique_code (que a rota pública devolve) e leva a /objeto/<código>', () => {
    expect(c).toContain('{(item.unique_code ?? item.code) && ('); expect(c).toContain('`/objeto/${encodeURIComponent((item.unique_code ?? item.code) as string)}`');
    expect(c).toContain('unique_code?: string;');
    expect(c).toContain('onClick={() => openLightbox(item.photos, 0)}');                 // a foto continua abrindo o ampliador
    expect(c).toContain('data-achei-selecionar={cod}');                                  // «É este» continua
  });
});

describe('Feed: frase do bloco depois do 3º card', () => {
  it('sem «mais recentes»; diz que a lista é um recorte e que o histórico está no mapa; o link para o mapa continua', () => {
    const f = read('src/app/feed/FeedClient.tsx');
    expect(f).toContain('A lista é um recorte das ocorrências de objetos, documentos e pets perdidos, achados ou roubados; o histórico está no mapa.');
    expect(f).not.toContain('Os registros mais recentes de objetos');
    expect(f).toContain('<Link href="/map" prefetch={false} className={linkCls}>Ver no mapa</Link>');
    expect(f).toContain('Ver histórico no mapa');
  });
});


// ─── Fechamento do #116: o caso que escapou (cadastro real em /objeto) e as demais saídas públicas ─────────────────────────────────────────────
const COMPLETO = { id: 'u9', unique_code: 'YFNMFR2O', title: 'Mochila vermelha', description: 'Mochila vermelha tipo saco.', status: 'lost', category: 'bag', photos: [],
  is_legacy: false, source: 'user', location: { lat: -23.4567891, lng: -46.5234567, address: RUA }, created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z' };
import * as ReactNS from 'react';
(globalThis as { React?: unknown }).React = ReactNS;
const comApi = async <T,>(payload: unknown, fn: () => Promise<T>): Promise<T> => {
  const antes = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = antes; }
};
describe('/objeto e /scan: a PÁGINA reduz mesmo quando a API que ela consulta devolve o endereço completo (o caso real que escapou na prévia)', () => {
  it('título/descrição, Open Graph, JSON-LD e o objeto passado à tela saem só com «bairro, cidade - UF» e coordenada de 3 casas', async () => {
    const mod = await import('@/app/objeto/[code]/page');
    const meta = await comApi(COMPLETO, () => mod.generateMetadata({ params: { code: 'YFNMFR2O' } }));
    expect(JSON.stringify(meta)).toContain('Vila Modelo, Guarulhos - SP'); expect(JSON.stringify(meta)).not.toMatch(/Palmeiras|1224|07040/);
    const el = await comApi({ success: true, data: COMPLETO }, () => mod.default({ params: { code: 'YFNMFR2O' } })) as { props: { children: { props: Record<string, unknown> }[] } };
    const [script, tela] = el.props.children as unknown as { props: Record<string, any> }[];
    const saida = JSON.stringify(script.props.dangerouslySetInnerHTML) + JSON.stringify(tela.props.obj);
    expect(saida).not.toMatch(/Palmeiras|1224|07040|-23\.4567891|-46\.5234567/); expect(saida).toContain('Vila Modelo, Guarulhos - SP'); expect(saida).toContain('-23.457');
  });
  it('legado e sinal público: a página entrega exatamente o que a API devolveu', async () => {
    const mod = await import('@/app/objeto/[code]/page');
    const leg = { ...COMPLETO, is_legacy: true, source: 'webjetos' };
    const el = await comApi(leg, () => mod.default({ params: { code: 'X' } })) as { props: { children: { props: Record<string, any> }[] } };
    expect(el.props.children[1].props.obj.location).toEqual(leg.location);
  });
  it('/scan/[code] tem a mesma defesa', async () => {
    const mod = await import('@/app/scan/[code]/page');
    const meta = await comApi(COMPLETO, () => mod.generateMetadata({ params: { code: 'YFNMFR2O' } }));
    expect(JSON.stringify(meta)).not.toMatch(/Palmeiras|1224|07040/);
  });
});

describe('coordenada pública (3 casas) só no cadastro de usuário; o servidor segue com o valor original', () => {
  it('/api/v1/objects/public: usuário com 3 casas; legado e sinal como estão; a ORDEM e os ids são os mesmos de antes do arredondamento', async () => {
    const lat = (o: Record<string, unknown>, k: string, n: number) => ({ ...o, latitude: k, longitude: String(n) });
    st.rows = [lat(USUARIO, '-23.4567891', -46.5234567), lat(LEGADO, '-23.4567891', -46.5234567), lat(SINAL, '-23.4567891', -46.5234567)];
    const j = await call('size=50&status=all');
    const por = (id: string) => j.items.find((i: { id: string }) => i.id === id);
    expect(por('u1').location.lat).toBe(-23.457); expect(por('u1').location.lng).toBe(-46.523);
    expect(por('l1').location.lat).toBe(-23.4567891); expect(por('s1').location.lng).toBe(-46.5234567);
    const ids = j.items.map((i: { id: string }) => i.id);
    vi.resetModules(); vi.doMock('@/lib/publicLocation', async (orig) => ({ ...(await orig() as object), localizacaoPublica: (l: unknown) => l }));
    const base = await (await import('@/app/api/v1/objects/public/route')).GET(new NextRequest('http://localhost/api/v1/objects/public?size=50&status=all'));
    vi.doUnmock('@/lib/publicLocation'); vi.resetModules();
    expect((await base.json()).items.map((i: { id: string }) => i.id)).toEqual(ids);
  });
  it('mapa: pins de usuário com 3 casas e sem endereço; legado/sinal exatos; a consulta traz is_legacy e source', async () => {
    const src = read('src/app/api/v1/objects/map/route.ts');
    expect(src).toMatch(/is_legacy,\s*source/); expect(src).toContain('arredondaCoordenada');
    st.rows = [{ id: 'm1', title: 'a', status: 'lost', category: 'bag', latitude: '-23.4567891', longitude: '-46.5234567', location: RUA, is_legacy: false, source: 'user' },
      { id: 'm2', title: 'b', status: 'lost', category: 'bag', latitude: '-23.4567891', longitude: '-46.5234567', location: RUA, is_legacy: true, source: 'webjetos' }];
    const { GET } = await import('@/app/api/v1/objects/map/route');
    const j = await (await GET()).json();
    expect(j.items.find((i: { id: string }) => i.id === 'm1').location).toEqual({ lat: -23.457, lng: -46.523 });
    expect(j.items.find((i: { id: string }) => i.id === 'm2').location).toEqual({ lat: -23.4567891, lng: -46.5234567 });
    expect(JSON.stringify(j)).not.toMatch(/Palmeiras|1224|07040/);
  });
});

describe('post social: o texto que será publicado leva só «bairro, cidade - UF»', () => {
  it('buildPostText reduz o endereço do usuário; sem endereço fica «Localização não informada»', async () => {
    const { buildPostText } = await import('@/lib/socialPost');
    const o = { id: 'u1', title: 'Mochila', status: 'lost', category: 'bag', unique_code: 'YFNMFR2O', location: { address: RUA } } as never;
    const t = buildPostText(o, '📍 {location}\n{url}', 'https://x.test');
    expect(t).toContain('Vila Modelo, Guarulhos - SP'); expect(t).not.toMatch(/Palmeiras|1224|07040/);
    expect(buildPostText({ ...(o as object), location: { address: 'Rua Sem Cidade 10' } } as never, '📍 {location}', 'https://x.test')).toContain('Localização não informada');
  });
});

describe('«Ver detalhes» em /buscar, aviso do Feed, layout do /achei e texto do /objeto', () => {
  it('/buscar foi desligado (redireciona ao Feed); a busca do Feed abre /objeto/CÓDIGO com o código do card (FeedItem.code), nunca o título', () => {
    const c = read('src/app/feed/FeedClient.tsx'); expect(c).toContain("`/objeto/${encodeURIComponent(item.code)}`");
    expect(existsSync(path.join(__dirname, '..', 'src/app/buscar/client.tsx'))).toBe(false);
  });
  it('Feed: aviso sem «recente» e com o link do histórico no mapa', () => {
    const c = read('src/app/feed/FeedClient.tsx'); expect(c).toContain('Esta lista é só um recorte.'); expect(c).not.toContain('recorte recente'); expect(c).toContain('Ver histórico no mapa');
  });
  it('/achei: «É este» e «Ver detalhes» na mesma linha, centralizados, folga de 12 px, quebra à esquerda; toque de 44 px', () => {
    const c = read('src/app/achei/client.tsx');
    expect(c).toContain('flex flex-wrap items-center gap-x-3 gap-y-1'); expect(c).not.toContain('mb-2 inline-flex min-h-[44px]');
    expect(c).toMatch(/inline-flex min-h-\[44px\] items-center gap-1 text-xs text-teal-400/);
  });
  it('tela de aviso enviado (/objeto e /scan): sem «chat da plataforma» nem promessa de resposta; texto fiel ao que acontece', () => {
    for (const f of ['src/app/objeto/[code]/client.tsx', 'src/app/scan/[code]/client.tsx']) {
      const c = read(f); expect(c, f).not.toContain('A conversa acontece pelo chat da plataforma'); expect(c, f).not.toContain('Dono entra em contato');
      expect(c, f).toContain('Seu aviso fica registrado'); expect(c, f).toContain('Push e e-mail saem só quando o dono não é legado'); expect(c, f).toContain('Não há garantia de resposta');
    }
  });
  it('/objeto (usuário): sem «chat da plataforma»/«o dono recebe um aviso» junto ao botão; texto fiel; sinal público sem o bloco', () => {
    const c = read('src/app/objeto/[code]/client.tsx');
    expect(c).toContain('Seu aviso fica registrado nesta ocorrência.'); expect(c).not.toContain('O dono recebe um aviso'); expect(c).not.toMatch(/<span[^>]*>A conversa acontece pelo chat da plataforma\.<\/span>/);
  });
});
