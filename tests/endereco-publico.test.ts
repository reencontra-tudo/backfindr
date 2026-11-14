// Endereço público só com «bairro, cidade - UF» (mesma redução do Feed) nas saídas públicas, só para cadastros de USUÁRIO. Legado e sinal público: idênticos.
// Casamento, pontuação, ordem e ids continuam pelo texto ORIGINAL; o dono segue vendo o endereço completo. Nomes e endereços inventados. Banco simulado.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
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
  it('as coordenadas não mudam e o objeto de entrada não é alterado', () => {
    const entrada = { lat: -23.45, lng: -46.52, address: RUA };
    const saida = localizacaoPublica(entrada, { source: null });
    expect(saida).toEqual({ lat: -23.45, lng: -46.52, address: 'Vila Modelo, Guarulhos - SP' }); expect(entrada.address).toBe(RUA);
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
    expect(p).toContain('/api/v1/objects/scan/${code}'); expect(p).toContain('obj.location?.address'); expect(p).not.toMatch(/location_addr|row\.location/);
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

describe('cartazes e posts sociais NÃO foram alterados', () => {
  it('não usam a redução pública (continuam com o que usavam)', () => {
    for (const f of ['src/lib/posterFormatter.ts', 'src/lib/socialPost.ts', 'src/app/api/v1/objects/[id]/poster/route.tsx']) expect(read(f), f).not.toMatch(/publicLocation|enderecoPublico|localizacaoPublica/);
    expect(read('src/lib/posterFormatter.ts')).toContain('const locationShort = clip(locationFull, 60)');
    expect(read('src/lib/socialPost.ts')).toContain("const location = obj.location?.address ?? '';");
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
