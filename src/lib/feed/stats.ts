// Contagem dos cards ELEGÍVEIS do Feed, para o painel admin (somente leitura).
// Usa a MESMA regra de elegibilidade da leitura do Feed (FEED_ELIGIBILITY_WHERE em query.ts) e a mesma classificação de origem
// (source = 'public_signal' → sinal público; o resto → usuário). Não lê nada além de contagens: nenhum dado de objeto sai daqui.
import { query } from '@/lib/db';
import { FEED_ELIGIBILITY_WHERE, FEED_MAX_CANDIDATES, type FeedStatus } from './query';

export interface PorStatus { total: number; lost: number; found: number; stolen: number }
export interface FeedEligibleCounts {
  total: number;
  usuarios: PorStatus;
  sinais_publicos: PorStatus;
  por_status: PorStatus;
  /** O Feed lê no máximo este número de cards por vez; acima disso, os mais antigos ficam de fora da lista. */
  teto_do_feed: number;
  acima_do_teto: boolean;
}

const vazio = (): PorStatus => ({ total: 0, lost: 0, found: 0, stolen: 0 });
const STATUS: FeedStatus[] = ['lost', 'found', 'stolen'];

/** SQL: só agrupa e conta. A regra de elegibilidade vem de FEED_ELIGIBILITY_WHERE (a mesma do Feed). */
export const FEED_COUNT_SQL = `
  SELECT (COALESCE(o.source, '') = 'public_signal') AS sinal, o.status AS status, COUNT(*)::int AS n
    FROM objects o
   WHERE ${FEED_ELIGIBILITY_WHERE}
   GROUP BY 1, 2`;

export function montarContagem(rows: Array<{ sinal: boolean; status: string; n: number | string }>): FeedEligibleCounts {
  const usuarios = vazio(), sinais = vazio(), todos = vazio();
  for (const r of rows) {
    if (!STATUS.includes(r.status as FeedStatus)) continue;      // só os 3 status do Feed (a regra já filtra; defesa extra)
    const n = Number(r.n) || 0, st = r.status as FeedStatus;
    const grupo = r.sinal ? sinais : usuarios;
    grupo[st] += n; grupo.total += n; todos[st] += n; todos.total += n;
  }
  return { total: todos.total, usuarios, sinais_publicos: sinais, por_status: todos, teto_do_feed: FEED_MAX_CANDIDATES, acima_do_teto: todos.total > FEED_MAX_CANDIDATES };
}

export async function countFeedEligible(): Promise<FeedEligibleCounts> {
  const res = await query(FEED_COUNT_SQL);
  return montarContagem(res.rows);
}
