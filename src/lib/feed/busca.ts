// Busca por texto DENTRO do Feed (servidor). Não é motor novo: usa os mesmos sinônimos, a mesma expansão de termos e o mesmo score mínimo da
// busca pública (src/lib/buscaPublica.ts, antes dentro de /api/v1/objects/public) e a regra de «busca ampla» (isBuscaAmpla).
//  • Quem pode aparecer: SÓ o que o Feed já mostra (FEED_ELIGIBILITY_WHERE: público, NÃO legado, lost/found/stolen, com código) e SÓ nos filtros que o
//    Feed já tem (situação, categoria, região): a lista vem de getRankedFeed (mesma elegibilidade, mesmas máscaras de nome, mesmo «bairro, cidade - UF»).
//  • O texto é casado no banco com o título/descrição ORIGINAIS (F-18), mas o que SAI é só a lista fixa de campos do card (FeedItem): nunca dono,
//    contato, coordenadas, descrição bruta, score nem o texto digitado.
import { query } from '@/lib/db';
import { SCORE_MIN_BUSCA, buildKeywordConditions, calcularScoreBusca, expandirKeyword, removerAcentos, type OpcoesBusca } from '@/lib/buscaPublica';
import { isBuscaAmpla } from '@/lib/flowMatch/relevance';
import { FEED_ELIGIBILITY_WHERE, getRankedFeed, toPublicItem, type FeedItem, type FeedParams } from './query';
import { BUSCA_MIN_CARACTERES, normalizarConsulta } from './consulta';

export const BUSCA_MAX_RESULTADOS = 60;
const BUSCA_MAX_CANDIDATOS = 1000;
/** Só o Feed liga estas opções (os demais consumidores da busca pública seguem como eram): sinônimos por radical e casamento sem acento. */
const OPCOES: OpcoesBusca = { radical: true, semAcento: true };

export interface ResultadoBusca {
  items: FeedItem[];
  /** true = a busca não tem palavras suficientes para identificar o objeto: nenhuma lista, só a orientação de dar mais detalhes. */
  ampla: boolean;
  /** true = o teto de leitura do Feed foi atingido (as ocorrências mais antigas ficaram de fora). */
  truncated: boolean;
}

export async function buscarNoFeed(textoBruto: unknown, filtros: FeedParams = {}): Promise<ResultadoBusca> {
  const q = normalizarConsulta(textoBruto);
  if (q.length < BUSCA_MIN_CARACTERES || isBuscaAmpla(q)) return { items: [], ampla: true, truncated: false };

  const ranked = await getRankedFeed(filtros);
  if (ranked.items.length === 0) return { items: [], ampla: false, truncated: ranked.truncated };

  const params: unknown[] = [];
  const kw = buildKeywordConditions(expandirKeyword(removerAcentos(q), OPCOES), params, OPCOES);
  const rows = await query(
    `SELECT o.qr_code AS code, o.title, o.description, o.color, o.category, o.type
       FROM objects o
      WHERE ${FEED_ELIGIBILITY_WHERE} AND ${kw}
      LIMIT ${BUSCA_MAX_CANDIDATOS}`,
    params,
  );
  const pontos = new Map<string, number>();
  for (const r of rows.rows as Array<Record<string, unknown>>) {
    const score = calcularScoreBusca(q, r, OPCOES);
    if (score >= SCORE_MIN_BUSCA) pontos.set(String(r.code), score);
  }

  // Mais relevante primeiro; empate: a ordem que o Feed já usa (sort estável). Só o que passa pelos filtros do Feed.
  const items = ranked.items
    .filter((r) => pontos.has(r.code))
    .sort((a, b) => (pontos.get(b.code) ?? 0) - (pontos.get(a.code) ?? 0))
    .slice(0, BUSCA_MAX_RESULTADOS)
    .map(toPublicItem);
  return { items, ampla: false, truncated: ranked.truncated };
}
