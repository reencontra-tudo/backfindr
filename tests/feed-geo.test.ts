// Rota GET /api/v1/feed/geo e a lógica de localização do Feed (src/lib/feed/geo.ts). Sem banco.
//   npx vitest@2 run --config tests/vitest.config.ts tests/feed-geo.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import * as routeModule from '@/app/api/v1/feed/geo/route';
import { geoFromIpapi, geoFromVercelHeaders, visitorIp, cleanCity } from '@/lib/feed/geo';

const { GET } = routeModule;
const NO = { country: null, uf: null, city: null };
const req = (headers: Record<string, string> = {}) => new NextRequest('http://localhost/api/v1/feed/geo', { headers });
const ipapiOk = (body: unknown, status = 200) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);
const call = async (headers: Record<string, string> = {}) => { const res = await GET(req(headers)); return { res, body: await res.json() }; };
const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

let fetchMock: ReturnType<typeof vi.fn>;
let consoleSpies: Array<ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  fetchMock = vi.fn(async () => { throw new Error('fetch não deveria ser chamado'); });
  vi.stubGlobal('fetch', fetchMock);
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('cabeçalhos da Vercel (prioridade 1)', () => {
  it('Brasil: país, sigla do estado e cidade decodificada (RFC 3986); a reserva NÃO é chamada', async () => {
    const { body } = await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo' });
    expect(body).toEqual({ country: 'BR', uf: 'SP', city: 'São Paulo' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Brasil sem cidade: devolve o estado (cidade nula)', async () => {
    expect((await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'pr' })).body).toEqual({ country: 'BR', uf: 'PR', city: null });
  });
  it('país diferente de BR: não localizado no Brasil; devolve só o país e NÃO chama a reserva', async () => {
    const { body } = await call({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'PA', 'x-vercel-ip-city': 'Pittsburgh' });
    expect(body).toEqual({ country: 'US', uf: null, city: null }); // «PA» dos EUA nunca vira o Pará
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sigla inválida (ZZ, vazia, número, texto longo): não localizado; cidade nunca sai sem estado válido', async () => {
    for (const region of ['ZZ', '', '12', 'SÃO', 'São Paulo']) {
      const { body } = await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': region, 'x-vercel-ip-city': 'Campinas' });
      expect(body, `região «${region}»`).toEqual({ country: 'BR', uf: null, city: null });
    }
    expect(fetchMock).not.toHaveBeenCalled(); // cabeçalho presente: a reserva só vale quando os cabeçalhos FALTAM
  });
  it('cidade malformada ou perigosa é descartada; o estado continua valendo', async () => {
    for (const city of ['%E0%A4%A', '<script>', 'a'.repeat(200), '%00']) {
      const { body } = await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'MG', 'x-vercel-ip-city': city });
      expect(body, city).toEqual({ country: 'BR', uf: 'MG', city: null });
    }
  });
});

describe('reserva ipapi.co (prioridade 2, só no servidor e só se os cabeçalhos faltarem)', () => {
  const XFF = { 'x-forwarded-for': '177.12.34.56, 10.0.0.1' };

  it('cabeçalhos ausentes: consulta o ipapi.co com o IP do visitante e devolve país, estado e cidade', async () => {
    fetchMock = ipapiOk({ country_code: 'BR', region_code: 'PR', city: 'Cascavel', latitude: -24.9, longitude: -53.4, ip: '177.12.34.56' });
    vi.stubGlobal('fetch', fetchMock);
    const { body } = await call(XFF);
    expect(body).toEqual({ country: 'BR', uf: 'PR', city: 'Cascavel' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ipapi.co/177.12.34.56/json/');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('aceita `country` (sigla) quando não há `country_code`', async () => {
    vi.stubGlobal('fetch', ipapiOk({ country: 'BR', region_code: 'SC', city: 'Brusque' }));
    expect((await call(XFF)).body).toEqual({ country: 'BR', uf: 'SC', city: 'Brusque' });
  });
  it('reserva devolvendo outro país: não localizado no Brasil (PA dos EUA não vira Pará)', async () => {
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'US', region_code: 'PA', city: 'Pittsburgh' }));
    expect((await call(XFF)).body).toEqual({ country: 'US', uf: null, city: null });
  });
  it('reserva sem o campo de estado ou com estado inválido: não localizado', async () => {
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'BR', city: 'Guarulhos' }));
    expect((await call(XFF)).body).toEqual({ country: 'BR', uf: null, city: null });
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'BR', region_code: 'XX', city: 'Guarulhos' }));
    expect((await call(XFF)).body).toEqual({ country: 'BR', uf: null, city: null });
  });
  it('reserva FALHANDO (rede, 429, erro do serviço, JSON ruim, tempo esgotado): 200 «não localizado», sem erro', async () => {
    const cenarios: Array<() => Promise<Response>> = [
      async () => { throw new TypeError('fetch failed'); },
      async () => ({ ok: false, status: 429, json: async () => ({ error: true, reason: 'RateLimited' }) }) as Response,
      async () => ({ ok: true, status: 200, json: async () => ({ error: true, reason: 'RateLimited' }) }) as Response,
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) as Response,
      async () => ({ ok: true, status: 200, json: async () => null }) as Response,
    ];
    for (const c of cenarios) {
      vi.stubGlobal('fetch', vi.fn(c));
      const { res, body } = await call(XFF);
      expect(res.status).toBe(200);
      expect(body).toEqual(NO);
    }
  });
  it('tempo esgotado de verdade (a reserva não responde): desiste em ~2,5 s e responde «não localizado»', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))));
    const t0 = Date.now();
    const { res, body } = await call(XFF);
    expect(res.status).toBe(200); expect(body).toEqual(NO);
    expect(Date.now() - t0).toBeLessThan(4000);
  }, 10_000);
  it('sem IP público (nenhum cabeçalho, IP privado, local ou lixo): NÃO chama a reserva', async () => {
    for (const h of [{}, { 'x-forwarded-for': '10.1.2.3' }, { 'x-forwarded-for': '192.168.0.9' }, { 'x-forwarded-for': '127.0.0.1' }, { 'x-forwarded-for': '172.20.1.1' },
      { 'x-forwarded-for': '::1' }, { 'x-forwarded-for': 'fd00::1' }, { 'x-forwarded-for': 'não-é-ip' }, { 'x-forwarded-for': '1.2.3.4/../../x' }, { 'x-real-ip': 'unknown' }]) {
      const { res, body } = await call(h);
      expect(res.status).toBe(200); expect(body).toEqual(NO);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('usa o primeiro IP da lista e aceita IPv6 público e x-real-ip', async () => {
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'BR', region_code: 'RJ', city: 'Niterói' }));
    await call({ 'x-forwarded-for': '2804:14d:1::1, 10.0.0.1' });
    expect((vi.mocked(fetch).mock.calls[0] as [string])[0]).toBe('https://ipapi.co/2804:14d:1::1/json/');
    await call({ 'x-real-ip': '200.1.2.3' });
    expect((vi.mocked(fetch).mock.calls[1] as [string])[0]).toBe('https://ipapi.co/200.1.2.3/json/');
  });
});

describe('nunca é guardada em cache e não guarda nada', () => {
  it('Cache-Control é exatamente «private, no-store» em TODAS as respostas (BR, outro país, não localizado, reserva ok, reserva falha)', async () => {
    const respostas = [
      await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'Osasco' }),
      await call({ 'x-vercel-ip-country': 'US' }),
      await call({}),
      await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'ZZ' }),
    ];
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'BR', region_code: 'BA', city: 'Salvador' }));
    respostas.push(await call({ 'x-forwarded-for': '189.1.2.3' }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('x'); }));
    respostas.push(await call({ 'x-forwarded-for': '189.1.2.3' }));
    for (const r of respostas) expect(r.res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('a rota é dinâmica (nunca pré-gerada no build) e só existe o GET', () => {
    expect(routeModule.dynamic).toBe('force-dynamic');
    expect(Object.keys(routeModule).filter((k) => /^(POST|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
  it('duas pessoas diferentes recebem respostas diferentes (nada de resposta reaproveitada)', async () => {
    const a = await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'Guarulhos' });
    const b = await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'PE', 'x-vercel-ip-city': 'Recife' });
    expect(a.body.uf).toBe('SP'); expect(b.body.uf).toBe('PE');
  });
  it('só 3 campos na resposta (país, estado, cidade): sem IP, sem coordenadas', async () => {
    vi.stubGlobal('fetch', ipapiOk({ country_code: 'BR', region_code: 'PR', city: 'Cascavel', ip: '177.12.34.56', latitude: -24.9, longitude: -53.4, org: 'x' }));
    const { body } = await call({ 'x-forwarded-for': '177.12.34.56' });
    expect(Object.keys(body).sort()).toEqual(['city', 'country', 'uf']);
    expect(JSON.stringify(body)).not.toMatch(/177\.12|-24\.9|-53\.4/);
  });
  it('nenhum log em nenhum caminho (sucesso, outro país, falha, sem IP)', async () => {
    await call({ 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'Osasco' });
    await call({ 'x-vercel-ip-country': 'US' });
    await call({});
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('falhou 177.12.34.56'); }));
    await call({ 'x-forwarded-for': '177.12.34.56' });
    for (const s of consoleSpies) expect(s).not.toHaveBeenCalled();
  });
  it('o código da rota e da lógica não toca banco, eventos nem PostHog, e não escreve log', () => {
    for (const f of ['src/app/api/v1/feed/geo/route.ts', 'src/lib/feed/geo.ts']) {
      const src = read(f).replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/@\/lib\/(db|events)|posthog|recordEvent|INSERT|UPDATE|localStorage|cookies\(|console\./i);
    }
  });
});

describe('cliente do Feed', () => {
  it('não chama mais o ipapi.co do navegador: usa a rota própria', () => {
    const src = read('src/app/feed/FeedClient.tsx');
    expect(src).not.toMatch(/ipapi\.co/);
    expect(src).toContain("'/api/v1/feed/geo'");
    expect(src).toContain('Não conseguimos identificar sua região. Escolha seu estado para ver ocorrências perto de você.');
  });
});

describe('funções puras', () => {
  it('visitorIp', () => {
    expect(visitorIp(new Headers({ 'x-forwarded-for': ' 8.8.8.8 , 10.0.0.1' }))).toBe('8.8.8.8');
    expect(visitorIp(new Headers())).toBeNull();
    expect(visitorIp(new Headers({ 'x-forwarded-for': '100.64.0.1' }))).toBeNull(); // CGNAT
  });
  it('geoFromVercelHeaders: ausente = null (vale a reserva)', () => {
    expect(geoFromVercelHeaders(new Headers())).toBeNull();
    expect(geoFromVercelHeaders(new Headers({ 'x-vercel-ip-country': '' }))).toBeNull();
  });
  it('geoFromIpapi e cleanCity', () => {
    expect(geoFromIpapi(undefined)).toEqual(NO); expect(geoFromIpapi('x')).toEqual(NO); expect(geoFromIpapi({ error: true })).toEqual(NO);
    expect(cleanCity('S%C3%A3o%20Paulo', true)).toBe('São Paulo'); expect(cleanCity('Santa Bárbara d\'Oeste')).toBe("Santa Bárbara d'Oeste");
    expect(cleanCity('x')).toBeNull();
  });
});
