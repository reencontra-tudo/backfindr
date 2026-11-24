// Rota GET /api/v1/news (painel «Notícias recentes» do mapa) com o Google News SIMULADO. Protege contra a regressão que o fundador quer evitar:
// a rota voltar a repassar tudo o que o Google devolve (como fez de 13/04/2026 a 24/11/2026) ou perder o cache.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
const AGORA = Date.parse('2026-11-24T05:00:00Z');
const rfc = (iso: string) => new Date(iso).toUTCString();

const item = (titulo: string, fonte: string, iso: string, n: number) =>
  `<item><title>${titulo} - ${fonte}</title><link>https://news.google.com/rss/articles/a${n}</link><pubDate>${rfc(iso)}</pubDate>` +
  `<description>&lt;a href="https://news.google.com/rss/articles/a${n}"&gt;${titulo}&lt;/a&gt;</description><source url="https://x.test">${fonte}</source></item>`;

const FEED = `<rss><channel>${[
  item('Polícia recupera 17 celulares com registro de roubo ou furto em casa abandonada em Belém', 'G1', '2026-11-20T10:00:00Z', 1),
  item('Meta lança app Achados no Brasil para disputar OLX e Enjoei', 'Exame', '2026-11-22T10:00:00Z', 2),
  item('Polícia Federal diz que não foram encontrados registros de conversas entre Vorcaro e Mendonça', 'Portal', '2026-11-23T10:00:00Z', 3),
  item('Uma plataforma única para encontrar itens perdidos no transporte', 'Île-de-France Mobilités', '2026-11-19T10:00:00Z', 4),
  item('Mais de três mil celulares roubados no Rio serão devolvidos para vítimas', 'CNN Brasil', '2026-11-10T10:00:00Z', 5),
  item('Polícia devolve celulares roubados a donos em Recife', 'Velha', '2026-09-01T10:00:00Z', 6),
].join('')}</channel></rss>`;

let chamadas: string[] = [];
let modo: 'ok' | 'falha' = 'ok';

async function carregarRota() {
  vi.resetModules(); // zera a memória da instância (cache em memória) entre os testes
  return (await import('@/app/api/v1/news/route')).GET;
}

beforeEach(() => {
  chamadas = []; modo = 'ok';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    chamadas.push(String(url));
    if (modo === 'falha') return { ok: false, status: 503, text: async () => '' };
    return { ok: true, status: 200, text: async () => FEED };
  }));
});

describe('GET /api/v1/news', () => {
  it('só devolve notícias do escopo: irrelevante, de outro país, velha ou sem data NÃO entram, e o HTML sai da descrição', async () => {
    const GET = await carregarRota();
    const res = await GET();
    const corpo = await res.json();
    expect(corpo.success).toBe(true);
    const titulos: string[] = corpo.news.map((n: { title: string }) => n.title);
    expect(titulos.some((t) => /Meta lança/.test(t))).toBe(false);
    expect(titulos.some((t) => /Vorcaro/.test(t))).toBe(false);
    expect(titulos.some((t) => /Île-de-France|plataforma única/.test(t))).toBe(false);
    expect(titulos.some((t) => /Recife/.test(t))).toBe(false); // de 01/09: mais de 30 dias
    expect(titulos).toHaveLength(2);
    expect(titulos[0]).toMatch(/17 celulares/);
    for (const n of corpo.news) {
      expect(n.description).not.toMatch(/[<>]|href|&lt;/);
      expect(Object.keys(n).sort()).toEqual(['description', 'link', 'pubDate', 'source', 'title']); // formato que o mapa lê não mudou
    }
  });

  it('cada busca do escopo é feita uma vez, em português do Brasil, e o mesmo item vindo de várias buscas aparece uma vez', async () => {
    const GET = await carregarRota();
    const corpo = await (await GET()).json();
    expect(chamadas.length).toBeGreaterThanOrEqual(6);
    for (const u of chamadas) { expect(u).toContain('news.google.com/rss/search'); expect(u).toContain('gl=BR'); }
    expect(new Set(corpo.news.map((n: { link: string }) => n.link)).size).toBe(corpo.news.length);
  });

  it('cache de verdade: cabeçalho para a rede da Vercel (6 h) e segunda chamada sem novas buscas', async () => {
    const GET = await carregarRota();
    const a = await GET();
    expect(a.headers.get('cache-control')).toBe('public, s-maxage=21600, stale-while-revalidate=86400');
    const n = chamadas.length;
    const b = await GET();
    expect((await b.json()).cached).toBe(true);
    expect(chamadas.length).toBe(n);
  });

  it('Google fora do ar: resposta sem itens NÃO fica guardada por 6 h (cache curto) e não vira erro 500', async () => {
    modo = 'falha';
    const GET = await carregarRota();
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).news).toEqual([]);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=300');
    modo = 'ok';
    expect((await (await GET()).json()).news.length).toBe(2); // a lista vazia não ficou na memória
  });
});

describe('guardas de código (a rota não pode voltar ao que era)', () => {
  const rota = read('src/app/api/v1/news/route.ts');
  it('a rota usa o filtro e as buscas de src/lib/noticias/filtro.ts', () => {
    expect(rota).toContain("from '@/lib/noticias/filtro'");
    expect(rota).toContain('filtrarNoticias(');
    expect(rota).toContain('BUSCAS');
  });
  it('não tem mais o stripHtml antigo, as buscas amplas antigas, nem o «revalidate» que o force-dynamic anulava', () => {
    expect(rota).not.toContain('function stripHtml');
    expect(rota).not.toContain('objeto perdido encontrado Brasil');
    expect(rota).not.toMatch(/export const revalidate/);
  });
  it('o pipeline do Public Signals continua com o próprio parser (não foi tocado)', () => {
    const ps = read('src/lib/publicSignals/sources.ts');
    expect(ps).toContain('MAX_ITEM_AGE_DAYS = 7');
    expect(ps).not.toContain('@/lib/noticias');
  });
  it('o painel do mapa continua lendo /api/v1/news e mostrando título, fonte e data', () => {
    const mapa = read('src/app/map/client.tsx');
    expect(mapa).toContain("fetch('/api/v1/news')");
    expect(mapa).toContain('{item.title}');
    expect(mapa).toContain('{item.source}');
  });
});
