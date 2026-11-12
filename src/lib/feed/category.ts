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

export function isFeedCategoryKey(v: string): v is FeedCategoryKey {
  return KNOWN.has(v);
}
