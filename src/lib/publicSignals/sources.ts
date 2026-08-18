import type { RawSignalItem } from './extract';

// ─── Fontes da primeira leva (seção 2 do prompt master) ────────────────────
// Ordem de prioridade: press_rss > institution > google_alert_corroboration.
// Dados abertos governamentais (SINESP etc.) ficam de fora — são agregados,
// não item-level, não alimentam este pipeline (servem pra inteligência de
// expansão, não pra popular o mapa).
// Redes sociais ficam de fora nesta rodada (risco de ToS já sinalizado na
// auditoria).

export interface Source {
  id: string;
  type: RawSignalItem['sourceType'];
  fetchItems: () => Promise<Omit<RawSignalItem, 'sourceType'>[]>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// Mesmo parser regex-based já usado em src/app/api/v1/news/route.ts —
// duplicado aqui de propósito (não refatorei a rota existente nesta rodada,
// pra não misturar mudança de escopo diferente na mesma leva).
function parseRSS(xml: string): { title: string; link: string; description: string }[] {
  const items: { title: string; link: string; description: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
    if (titleMatch && linkMatch) {
      const title = stripHtml(titleMatch[1]);
      const link = linkMatch[1].trim();
      const description = descMatch ? stripHtml(descMatch[1]).substring(0, 500) : '';
      if (title && title.length > 10 && link.startsWith('http')) {
        items.push({ title, link, description });
      }
    }
  }
  return items;
}

async function fetchGoogleNewsRSS(query: string): Promise<{ title: string; link: string; description: string }[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Backfindr/1.0; +https://backfindr.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    return parseRSS(await response.text());
  } catch {
    return [];
  }
}

// ─── press_rss: Google News, mesmas consultas de src/app/api/v1/news/route.ts
// Não-oficial (sem SLA/contrato) — sinalizado na auditoria original como
// risco médio, mantido mas monitorado, conforme decisão do prompt master.
const PRESS_QUERIES = [
  'objeto perdido encontrado Brasil',
  'celular roubado recuperado Brasil',
  'achado e entregue Brasil',
  'animal perdido encontrado Brasil',
];

const pressRssSource: Source = {
  id: 'google_news_press',
  type: 'press_rss',
  async fetchItems() {
    const results = await Promise.allSettled(PRESS_QUERIES.map(fetchGoogleNewsRSS));
    const items: Omit<RawSignalItem, 'sourceType'>[] = [];
    const seenLinks = new Set<string>();
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        if (seenLinks.has(item.link)) continue;
        seenLinks.add(item.link);
        items.push(item);
      }
    }
    return items;
  },
};

// ─── institution: feeds próprios de aeroportos, metrô, universidades etc. ──
// Vazio de propósito — cada URL precisa ser curada e verificada (ToS/RSS
// oficial) antes de entrar aqui, não é algo pra inventar. Formato esperado:
// { id: 'aeroporto-guarulhos', type: 'institution', fetchItems: () => fetchGoogleNewsRSS-style ou parser específico }
const institutionSources: Source[] = [];

// ─── google_alert_corroboration: RSS nativo de alertas já configurados ─────
// Vazio de propósito, mesma razão — cole aqui a URL de RSS gerada pelo
// Google Alerts (google.com/alerts) quando tiver alertas configurados.
// Importante: itens desta fonte NUNCA criam evidência nova sozinhos — o
// endpoint de ingestão só os mantém se baterem no dedup_hash de um item já
// visto por outra fonte (ver comentário no route.ts). Isso implementa
// "nunca fonte primária isolada" sem precisar de lógica extra.
const googleAlertSources: Source[] = [];

export const SOURCES: Source[] = [pressRssSource, ...institutionSources, ...googleAlertSources];
