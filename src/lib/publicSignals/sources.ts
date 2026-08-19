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
  fetchItems: () => Promise<Omit<RawSignalItem, 'sourceType' | 'regionHint'>[]>;
  // Cidade/estado que essa fonte cobre exclusivamente, se houver — repassado
  // pro LLM em extract.ts pra desambiguar bairros com nome repetido em
  // outras cidades (ex: "Morumbi" existe em Cascavel-PR E em São Paulo).
  // Ver comentário completo em extract.ts::RawSignalItem.regionHint.
  regionHint?: string;
}

// ── Filtro de idade (achado em 19/08/2026) ──────────────────────────────────
// O RSS do Google News devolve qualquer artigo que bate com a busca, sem
// limite de data — dois casos reais encontrados testando: uma notícia de
// gato perdido de 25/12/2022 (quase 4 anos) e outra de 02/05/2026 (~3,5
// meses), ambas entrando na fila parecendo "recentes" porque só
// guardávamos a data em que NÓS coletamos (captured_at), nunca a data de
// publicação da fonte original. Corrigido: extrai <pubDate> do item e
// descarta antes até de gastar chamada de LLM em extração.
const MAX_ITEM_AGE_DAYS = 7;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

interface RSSItem { title: string; link: string; description: string; pubDate: Date | null }

// Mesmo parser regex-based já usado em src/app/api/v1/news/route.ts —
// duplicado aqui de propósito (não refatorei a rota existente nesta rodada,
// pra não misturar mudança de escopo diferente na mesma leva).
function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (titleMatch && linkMatch) {
      const title = stripHtml(titleMatch[1]);
      const link = linkMatch[1].trim();
      const description = descMatch ? stripHtml(descMatch[1]).substring(0, 500) : '';
      const parsedDate = pubDateMatch ? new Date(pubDateMatch[1].trim()) : null;
      const pubDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null;
      if (title && title.length > 10 && link.startsWith('http')) {
        items.push({ title, link, description, pubDate });
      }
    }
  }
  return items;
}

// Descarta itens sem data válida OU mais velhos que MAX_ITEM_AGE_DAYS.
// Fail-safe deliberado: sem pubDate parseável, não dá pra confirmar que é
// recente, então trata como se fosse — mesma lógica de "informação com
// confiabilidade insuficiente não publica" aplicada aqui à idade.
function filterByAge(items: RSSItem[]): { title: string; link: string; description: string }[] {
  const cutoff = Date.now() - MAX_ITEM_AGE_DAYS * 24 * 60 * 60 * 1000;
  return items
    .filter(item => item.pubDate !== null && item.pubDate.getTime() >= cutoff)
    .map(({ title, link, description }) => ({ title, link, description }));
}

async function fetchAndParseRSS(url: string): Promise<{ title: string; link: string; description: string }[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Backfindr/1.0; +https://backfindr.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    return filterByAge(parseRSS(await response.text()));
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
    const urls = PRESS_QUERIES.map(q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`);
    const results = await Promise.allSettled(urls.map(fetchAndParseRSS));
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

// ─── institution: feeds de achados-e-perdidos estruturados de veículos
// regionais. Diferente de imprensa genérica (busca por palavra-chave que
// pode trazer qualquer coisa) — aqui é o feed de uma editoria dedicada.
//
// CGN (Cascavel/PR): achados-e-perdidos.cgn.app.br é a plataforma de
// submissão própria deles, sindicada como categoria WordPress com RSS
// oficial (achado em 19/08/2026) — robots.txt não restringe, feed tem
// PubSubHubbub (feito pra consumo automatizado), conteúdo 100% no assunto,
// sem precisar de scraper de HTML nenhum.
const institutionSources: Source[] = [
  {
    id: 'cgn_achados_e_perdidos',
    type: 'institution',
    fetchItems: () => fetchAndParseRSS('https://cgn.inf.br/achados-e-perdidos/feed'),
    // Achado em 19/08/2026: sem isso, "bairro Morumbi" geocodificava pro
    // Morumbi de São Paulo em vez do de Cascavel-PR (única cobertura real
    // deste feed). 1 objeto ao vivo corrigido manualmente; isto evita repetir.
    regionHint: 'Cascavel, PR',
  },
];

// ─── google_alert_corroboration: ainda vazio ────────────────────────────────
// Decisão explícita (não é falta de URL a preencher): em vez de manter uma
// lista fixa de alertas configurados manualmente, a direção definida é
// adicionar um componente de busca geral via SERP API (ex: Brave Search
// API / SerpAPI) que cobre isso sem depender de configuração manual. Ainda
// NÃO implementado — registrado como próximo passo. Quando existir, a
// regra já implementada no route.ts continua valendo: itens daqui NUNCA
// criam evidência nova sozinhos, só sobrevivem se baterem no dedup_hash de
// algo que outra fonte já reportou — isso é o que garante "nunca fonte
// primária isolada", sem precisar de lógica extra quando a fonte for
// plugada.
const googleAlertSources: Source[] = [];

export const SOURCES: Source[] = [pressRssSource, ...institutionSources, ...googleAlertSources];
