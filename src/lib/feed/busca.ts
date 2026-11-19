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
import { SCORE_MIN_BUSCA, buildKeywordConditions, calcularScoreBusca, categoriasDaBuscaTexto, expandirKeyword, nivelBuscaAmpliada, palavrasExatasBusca, removerAcentos, type OpcoesBusca } from '@/lib/buscaPublica';
import { isBuscaAmpla } from '@/lib/flowMatch/relevance';
import { FEED_ELIGIBILITY_WHERE, getRankedFeed, toPublicItem, type FeedItem, type FeedParams } from './query';
import { BUSCA_MIN_CARACTERES, normalizarConsulta } from './consulta';

export const BUSCA_MAX_RESULTADOS = 60;
const BUSCA_MAX_CANDIDATOS = 1000;
/** Só o Feed liga estas opções (os demais consumidores da busca pública seguem como eram): sinônimos por radical e casamento sem acento. */
const OPCOES: OpcoesBusca = { radical: true, semAcento: true, dicionario: 'ampliado' };

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

  const opcoes: OpcoesBusca = { ...OPCOES, categoriasDaBusca: categoriasDaBuscaTexto(q, OPCOES) };
  const params: unknown[] = [];
  const kw = buildKeywordConditions(expandirKeyword(removerAcentos(q), opcoes), params, opcoes);
  const rows = await query(
    `SELECT o.qr_code AS code, o.title, o.description, o.color, o.brand, o.category, o.type
       FROM objects o
      WHERE ${FEED_ELIGIBILITY_WHERE} AND ${kw}
      LIMIT ${BUSCA_MAX_CANDIDATOS}`,
    params,
  );
  // Nível 0 = palavra exata; 1 = termo novo do dicionário (ou categoria pedida); 2 = nota. A nota só desempata dentro do nível (src/lib/buscaPublica.ts).
  const nivel = new Map<string, number>(); const pontos = new Map<string, number>(); const exatas = new Map<string, number>();
  for (const r of rows.rows as Array<Record<string, unknown>>) {
    const code = String(r.code);
    const nota = calcularScoreBusca(q, r, opcoes);
    const n = nivelBuscaAmpliada(q, r, nota, opcoes);
    if (n === null) continue;
    nivel.set(code, n); pontos.set(code, nota); exatas.set(code, palavrasExatasBusca(q, r));
  }

  // Do nível mais forte para o mais fraco; dentro dele, nota e depois palavras exatas; empate: a ordem que o Feed já usa (sort estável). Só o que passa pelos filtros do Feed.
  const items = ranked.items
    .filter((r) => nivel.has(r.code))
    .sort((a, b) => (nivel.get(a.code) ?? 9) - (nivel.get(b.code) ?? 9) || (pontos.get(b.code) ?? 0) - (pontos.get(a.code) ?? 0) || (exatas.get(b.code) ?? 0) - (exatas.get(a.code) ?? 0))
    .slice(0, BUSCA_MAX_RESULTADOS)
    .map(toPublicItem);
  return { items, ampla, truncated: ranked.truncated };
}
