import crypto from 'crypto';
import { normalizarPalavra, tokenizar } from './textNormalization';

// ─── Dedup fino: hash de conteúdo normalizado ──────────────────────────────
// title + category + location, tokenizado/normalizado e ordenado — duas
// notícias sobre a mesma ocorrência (título com ordem de palavras diferente,
// fontes diferentes) caem no mesmo hash mesmo sem ter a mesma source_url.
//
// Deliberadamente simples pro MVP (seção 7 do prompt): filtro grosso por
// hash, sem embeddings/pgvector — isso fica pra quando o volume justificar.
export function computeContentHash(title: string, category: string, locationText: string | null): string {
  const titleTokens = tokenizar(title).map(normalizarPalavra).sort();
  const catNorm = normalizarPalavra(category || '');
  const locNorm = locationText ? normalizarPalavra(locationText.split(/\s+/)[0] || '') : '';
  const base = `${titleTokens.join(' ')}|${catNorm}|${locNorm}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}
