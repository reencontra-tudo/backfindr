// Painel «Notícias recentes» do mapa. Busca o Google News RSS com as BUSCAS do escopo (recuperação/devolução de bens perdidos, furtados ou roubados no Brasil)
// e devolve SÓ o que passa em `filtrarNoticias` (relevância, idade, país, duplicados). O filtro e as regras vivem em `src/lib/noticias/filtro.ts`;
// os testes `tests/noticias-*.test.ts` garantem que esta rota continua usando o filtro.
//
// CACHE (definido de verdade em 24/11/2026): antes, `force-dynamic` anulava o `revalidate` e só existia cache em memória por instância. Agora:
//  1) cabeçalho `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400` na resposta com itens (a rede da Vercel guarda por 6 h para todas as instâncias);
//  2) resposta SEM itens (falha do Google ou filtro que não achou nada) usa `s-maxage=300`, para não guardar uma lista vazia por 6 h;
//  3) a memória da instância continua como segunda camada (só guarda resposta com itens).
// `force-dynamic` fica de propósito: evita buscar o Google durante o build.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BUSCAS, filtrarNoticias, lerRss, urlDaBusca, type Noticia } from '@/lib/noticias/filtro';

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas em ms
const CC_COM_ITENS = 'public, s-maxage=21600, stale-while-revalidate=86400';
const CC_SEM_ITENS = 'public, s-maxage=300, stale-while-revalidate=300';

let cachedNews: Noticia[] = [];
let cacheTimestamp = 0;

async function buscar(busca: string): Promise<Noticia[]> {
  try {
    const response = await fetch(urlDaBusca(busca), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Backfindr/1.0; +https://backfindr.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    return lerRss(await response.text());
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const now = Date.now();

    if (cachedNews.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(
        { success: true, news: cachedNews, cached: true, cachedAt: new Date(cacheTimestamp).toISOString() },
        { headers: { 'Cache-Control': CC_COM_ITENS } },
      );
    }

    const resultados = await Promise.allSettled(BUSCAS.map((q) => buscar(q)));
    const todos: Noticia[] = [];
    for (const r of resultados) if (r.status === 'fulfilled') todos.push(...r.value);

    const news = filtrarNoticias(todos, { agora: now });

    if (news.length > 0) { cachedNews = news; cacheTimestamp = now; }

    return NextResponse.json(
      { success: true, news, cached: false, cachedAt: new Date(now).toISOString() },
      { headers: { 'Cache-Control': news.length > 0 ? CC_COM_ITENS : CC_SEM_ITENS } },
    );
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar notícias', news: [] },
      { status: 500 },
    );
  }
}
