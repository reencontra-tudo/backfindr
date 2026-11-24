// Categorias do Feed. «pet» e «animal» são a mesma categoria. Categorias sujas (por exemplo «found», «lost»,
// vazio ou qualquer valor desconhecido) aparecem como «Outros» SOMENTE na tela: o dado no banco não é alterado.
export type FeedCategoryKey =
  | 'pet' | 'document' | 'phone' | 'wallet' | 'keys' | 'bag' | 'bike' | 'vehicle'
  | 'jewelry' | 'electronics' | 'clothing' | 'other';

export const FEED_CATEGORY_LABELS: Record<FeedCategoryKey, string> = {
  pet: 'Pet', document: 'Documento', phone: 'Celular', wallet: 'Carteira', keys: 'Chaves',
  bag: 'Bolsa ou mochila', bike: 'Bicicleta', vehicle: 'Veículo', jewelry: 'Joia',
  electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outros',
};

const ALIASES: Record<string, FeedCategoryKey> = { animal: 'pet' };
const KNOWN = new Set<string>(Object.keys(FEED_CATEGORY_LABELS));

export function feedCategoryKey(raw: string | null | undefined): FeedCategoryKey {
  const k = (raw ?? '').trim().toLowerCase();
  if (KNOWN.has(k)) return k as FeedCategoryKey;
  return ALIASES[k] ?? 'other';
}

/**
 * Rótulo para EXIBIR no Feed. «animal» aparece como «Animal», não como «Pet» (decisão do fundador, 24/11/2026: exceção pontual, só o rótulo).
 * A CHAVE (`feedCategoryKey`, que ainda traduz animal → pet) NÃO muda: filtros e busca do Feed seguem como eram.
 */
export function feedCategoryLabel(raw: string | null | undefined, key: FeedCategoryKey = feedCategoryKey(raw)): string {
  return (raw ?? '').trim().toLowerCase() === 'animal' ? 'Animal' : FEED_CATEGORY_LABELS[key];
}

export function isFeedCategoryKey(v: string): v is FeedCategoryKey {
  return KNOWN.has(v);
}
