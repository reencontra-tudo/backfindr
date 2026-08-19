// ─── Busca de página avulsa (canal de entrada manual, seção 6) ─────────────
// Diferente de sources.ts: ali o RSS já entrega <title>/<description>
// estruturados pelo feed. Aqui é uma URL solta (achada manualmente, via
// Perplexity, etc.) — precisamos buscar a página e extrair título/texto
// nós mesmos antes de poder chamar extract.ts, que espera exatamente esse
// formato (title + description).

interface FetchedPage {
  title: string;
  description: string;
}

// Mesmo padrão de strip+decode já usado em sources.ts — duplicado aqui de
// propósito, mesma razão documentada lá: não misturar refactor cross-file
// numa mudança de escopo diferente.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_DESCRIPTION_CHARS = 3000;

export async function fetchPageContent(url: string): Promise<FetchedPage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Backfindr/1.0; +https://backfindr.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : '';
    if (!title) return null; // sem nem título, não há base confiável pra extração

    // Preferência: og:description / meta description (texto já resumido
    // pelo próprio site) — só cai pro corpo inteiro se a página não tiver
    // nenhuma das duas, porque strip do <body> inteiro traz nav/rodapé
    // junto (ruído que a extração via LLM já tolera, mas é pior sinal).
    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i);
    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);

    let description = ogDescMatch
      ? stripHtml(ogDescMatch[1])
      : metaDescMatch
      ? stripHtml(metaDescMatch[1])
      : '';

    if (!description) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyHtml = (bodyMatch ? bodyMatch[1] : html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ');
      description = stripHtml(bodyHtml).substring(0, MAX_DESCRIPTION_CHARS);
    } else {
      description = description.substring(0, MAX_DESCRIPTION_CHARS);
    }

    return { title, description };
  } catch (err) {
    console.error('[publicSignals/fetchPage] falha ao buscar página', err);
    return null;
  }
}
