// Categorias do Feed. HIERARQUIA (decisão do fundador, 24/11/2026): «animal» é a categoria-MÃE e «pet» é filha: o filtro Animal mostra animal + pet; o filtro Pet mostra SÓ pet
// (um cavalo roubado não é pet). Antes, «animal» era tratado como «pet». Categorias sujas (por exemplo «found», «lost»,
// vazio ou qualquer valor desconhecido) aparecem como «Outros» SOMENTE na tela: o dado no banco não é alterado.
export type FeedCategoryKey =
  | 'animal' | 'pet' | 'document' | 'phone' | 'wallet' | 'keys' | 'bag' | 'bike' | 'vehicle'
  | 'jewelry' | 'electronics' | 'clothing' | 'other';

export const FEED_CATEGORY_LABELS: Record<FeedCategoryKey, string> = {
  animal: 'Animal', pet: 'Pet', document: 'Documento', phone: 'Celular', wallet: 'Carteira', keys: 'Chaves',
  bag: 'Bolsa ou mochila', bike: 'Bicicleta', vehicle: 'Veículo', jewelry: 'Joia',
  electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outros',
};

const ALIASES: Record<string, FeedCategoryKey> = {};
const KNOWN = new Set<string>(Object.keys(FEED_CATEGORY_LABELS));

export function feedCategoryKey(raw: string | null | undefined): FeedCategoryKey {
  const k = (raw ?? '').trim().toLowerCase();
  if (KNOWN.has(k)) return k as FeedCategoryKey;
  return ALIASES[k] ?? 'other';
}

/** Filhas de cada categoria-mãe no FILTRO do Feed (animal ⊃ pet e eletrônico ⊃ celular, decisão do fundador de 24/11/2026; mesmas relações de `src/lib/categorias.ts`). */
const FILHAS: Readonly<Record<string, readonly FeedCategoryKey[]>> = { animal: ['pet'], electronics: ['phone'] };

/** O item de categoria `itemKey` aparece no filtro `filtro`? A categoria-mãe inclui as filhas; a filha NUNCA inclui a mãe (Pet não mostra «animal»). */
export function feedPertenceAoFiltro(itemKey: FeedCategoryKey, filtro: string): boolean {
  return itemKey === filtro || (FILHAS[filtro]?.includes(itemKey) ?? false);
}

export function isFeedCategoryKey(v: string): v is FeedCategoryKey {
  return KNOWN.has(v);
}
