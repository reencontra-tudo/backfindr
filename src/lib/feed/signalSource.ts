// Fonte estruturada de um SINAL PÚBLICO para a página /objeto/[code]: o mesmo dado que o Feed mostra nos cards
// («Fonte: <veículo>» + link): evidência APROVADA com link http(s), a mais recente; o nome vem de sourceName (query.ts).
// Só lê. Nunca lança: sem fonte (ou erro) devolve null e a página mostra o texto para «sem fonte identificável».
import { query } from '@/lib/db';
import { sourceName } from './query';

export interface SignalSource {
  url: string;
  /** Nome para mostrar (veículo/órgão). Google Notícias é um agregador: o link pode não abrir a notícia original. */
  name: string | null;
  agregador: boolean;
}

/** Mesmas condições da fonte nos cards do Feed (src/lib/feed/query.ts, FEED_SQL). */
export const SIGNAL_SOURCE_SQL = `
  SELECT e.source_url FROM public_signal_evidence e
   WHERE e.object_id = $1 AND e.status = 'approved'
     AND left(e.source_url, 4) = 'http'
   ORDER BY e.created_at DESC LIMIT 1`;

export function toSignalSource(url: unknown): SignalSource | null {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  const name = sourceName(url);
  return { url, name, agregador: name === 'Google Notícias' };
}

export async function getSignalSource(objectId: string): Promise<SignalSource | null> {
  try {
    const r = await query(SIGNAL_SOURCE_SQL, [objectId]);
    return toSignalSource(r.rows[0]?.source_url);
  } catch (e) {
    console.warn('[objeto] fonte do sinal público indisponível', e);
    return null;
  }
}
