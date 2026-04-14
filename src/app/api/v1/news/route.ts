export const dynamic = 'force-dynamic';
export const revalidate = 21600; // cache de 6 horas

import { NextResponse } from 'next/server';

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
}

// Termos de busca relevantes para o contexto do Backfindr
const SEARCH_QUERIES = [
  'objeto perdido encontrado Brasil',
  'celular roubado recuperado Brasil',
  'achado e entregue Brasil',
];

// Cache em memória para evitar requisições excessivas ao Google
let cachedNews: NewsItem[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas em ms

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);

    if (titleMatch && linkMatch) {
      const title = stripHtml(titleMatch[1]);
      const link = linkMatch[1].trim();
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
      const source = sourceMatch ? stripHtml(sourceMatch[1]) : 'Google News';
      const description = descMatch ? stripHtml(descMatch[1]).substring(0, 200) : '';

      // Filtrar títulos muito genéricos ou irrelevantes
      if (title && title.length > 10 && link.startsWith('http')) {
        items.push({ title, link, source, pubDate, description });
      }
    }
  }

  return items;
}

async function fetchNewsFromQuery(query: string): Promise<NewsItem[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Backfindr/1.0; +https://backfindr.vercel.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    return parseRSS(xml);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const now = Date.now();

    // Retornar cache se ainda válido
    if (cachedNews.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        news: cachedNews,
        cached: true,
        cachedAt: new Date(cacheTimestamp).toISOString(),
      });
    }

    // Buscar notícias de todas as queries em paralelo
    const results = await Promise.allSettled(
      SEARCH_QUERIES.map(q => fetchNewsFromQuery(q))
    );

    const allNews: NewsItem[] = [];
    const seenTitles = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const item of result.value) {
          // Deduplicar por título (normalizado)
          const normalizedTitle = item.title.toLowerCase().substring(0, 60);
          if (!seenTitles.has(normalizedTitle)) {
            seenTitles.add(normalizedTitle);
            allNews.push(item);
          }
        }
      }
    }

    // Ordenar por data mais recente e limitar a 15 itens
    const sortedNews = allNews
      .sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 15);

    // Atualizar cache
    cachedNews = sortedNews;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      news: sortedNews,
      cached: false,
      cachedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar notícias', news: [] },
      { status: 500 }
    );
  }
}
