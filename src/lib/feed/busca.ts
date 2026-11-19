// Busca por texto DENTRO do Feed (servidor). Não é motor novo: usa os mesmos sinônimos, a mesma expansão de termos e o mesmo score mínimo da
// busca pública (src/lib/buscaPublica.ts, antes dentro de /api/v1/objects/public) e a regra de «busca ampla» (isBuscaAmpla).
//  • Quem pode aparecer: SÓ o que o Feed já mostra (FEED_ELIGIBILITY_WHERE: público, NÃO legado, lost/found/stolen, com código) e SÓ nos filtros que o
//    Feed já tem (situação, categoria, região): a lista vem de getRankedFeed (mesma elegibilidade, mesmas máscaras de nome, mesmo «bairro, cidade - UF»).
//  • Quem entra: nota >= SCORE_MIN_BUSCA (a da busca pública, que só soma ponto por sinônimo/descrição/cor) OU uma palavra que IDENTIFICA o objeto
//    (sem cor, palavra vazia nem descrição genérica) aparecendo INTEIRA no título ou na descrição. A nota continua valendo só para ordenar. Sem isto,
//    «carro» (10 pontos: 1 palavra no título, sem sinônimo) não achava «Roubaram carro do meu pai…». Vale só para o Feed (SCORE_MIN_BUSCA não muda).
//  • Busca ampla (isBuscaAmpla) só liga o aviso `ampla`; a lista é sempre devolvida (decisão do Marcos, F-38).
//  • O texto é casado no banco com o título/descrição ORIGINAIS (F-18), mas o que SAI é só a lista fixa de campos do card (FeedItem): nunca dono,
//    contato, coordenadas, descrição bruta, score nem o texto digitado.
import { query } from '@/lib/db';
import { SCORE_MIN_BUSCA, buildKeywordConditions, calcularScoreBusca, expandirKeyword, removerAcentos, type OpcoesBusca } from '@/lib/buscaPublica';
import { isBuscaAmpla, palavrasDeIdentificacao } from '@/lib/flowMatch/relevance';
import { normalizarPalavra as radical } from '@/lib/publicSignals/textNormalization';
import { FEED_ELIGIBILITY_WHERE, getRankedFeed, toPublicItem, type FeedItem, type FeedParams } from './query';
import { BUSCA_MIN_CARACTERES, normalizarConsulta } from './consulta';

export const BUSCA_MAX_RESULTADOS = 60;
const BUSCA_MAX_CANDIDATOS = 1000;
/** Só o Feed liga estas opções (os demais consumidores da busca pública seguem como eram): sinônimos por radical e casamento sem acento. */
const OPCOES: OpcoesBusca = { radical: true, semAcento: true };

/** Palavras inteiras de um texto, sem acento, no singular simples (a mesma normalização da busca): «carro,» e «Carros» viram «carro». */
const palavrasDoTexto = (t: unknown): Set<string> =>
  new Set(removerAcentos(String(t ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(radical));

export interface ResultadoBusca {
  items: FeedItem[];
  /** true = a busca tem menos de 2 palavras que identifiquem o objeto (isBuscaAmpla). É SÓ um aviso para a tela: a lista vem normalmente. */
  ampla: boolean;
  /** true = o teto de leitura do Feed foi atingido (as ocorrências mais antigas ficaram de fora). */
  truncated: boolean;
}

export async function buscarNoFeed(textoBruto: unknown, filtros: FeedParams = {}): Promise<ResultadoBusca> {
  const q = normalizarConsulta(textoBruto);
  if (q.length < BUSCA_MIN_CARACTERES) return { items: [], ampla: false, truncated: false }; // texto curto demais: não consulta nada
  const ampla = isBuscaAmpla(q); // decisão do Marcos (F-38): busca ampla NÃO bloqueia a lista; só pede um aviso na tela

  const ranked = await getRankedFeed(filtros);
  if (ranked.items.length === 0) return { items: [], ampla, truncated: ranked.truncated };

  const params: unknown[] = [];
  const kw = buildKeywordConditions(expandirKeyword(removerAcentos(q), OPCOES), params, OPCOES);
  const rows = await query(
    `SELECT o.qr_code AS code, o.title, o.description, o.color, o.category, o.type
       FROM objects o
      WHERE ${FEED_ELIGIBILITY_WHERE} AND ${kw}
      LIMIT ${BUSCA_MAX_CANDIDATOS}`,
    params,
  );
  const ids = palavrasDeIdentificacao(q);
  const pontos = new Map<string, number>();
  const literais = new Map<string, number>(); // quantas palavras da busca aparecem inteiras no título/descrição (desempate)
  for (const r of rows.rows as Array<Record<string, unknown>>) {
    const code = String(r.code);
    const score = calcularScoreBusca(q, r, OPCOES);
    const doTexto = new Set([...palavrasDoTexto(r.title), ...palavrasDoTexto(r.description)]);
    const literal = ids.filter((w) => doTexto.has(w)).length;
    if (score >= SCORE_MIN_BUSCA || literal > 0) { pontos.set(code, score); literais.set(code, literal); }
  }

  // Mais relevante primeiro; empate: a ordem que o Feed já usa (sort estável). Só o que passa pelos filtros do Feed.
  const items = ranked.items
    .filter((r) => pontos.has(r.code))
    .sort((a, b) => (pontos.get(b.code) ?? 0) - (pontos.get(a.code) ?? 0) || (literais.get(b.code) ?? 0) - (literais.get(a.code) ?? 0))
    .slice(0, BUSCA_MAX_RESULTADOS)
    .map(toPublicItem);
  return { items, ampla, truncated: ranked.truncated };
}
