// Mapa de categorias COMPARTILHADO (decisão do fundador, 24/11/2026: hierarquia de categorias).
// PRINCÍPIO: cada ocorrência guarda UMA categoria, a mais específica; a categoria-MÃE inclui as FILHAS.
//   Animal (mãe) ⊃ Pet        — todo pet é animal; nem todo animal é pet (um cavalo roubado não é pet).
//   Eletrônico (mãe) ⊃ Celular — todo celular é eletrônico; nem todo eletrônico é celular.
// A hierarquia é definida SÓ aqui. Hoje ela é aplicada nos FILTROS DO MAPA (`src/app/map/client.tsx`); outros usos (cadastro de «Animal») virão em outro PR.
// Nada aqui altera dado: «book» e categoria nula/desconhecida aparecem em «Outro» só na hora de filtrar.

/** Categorias que o produto conhece (valores gravados em `objects.category`). */
export const CATEGORIAS = [
  'phone', 'wallet', 'keys', 'bag', 'animal', 'pet', 'bike', 'vehicle', 'document', 'jewelry', 'electronics', 'clothing', 'other',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** filha → mãe. Só estas duas relações existem. */
export const CATEGORIA_MAE: Readonly<Partial<Record<Categoria, Categoria>>> = {
  pet: 'animal',
  phone: 'electronics',
};

export const CATEGORIA_ROTULO: Readonly<Record<Categoria, string>> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa/Mochila', animal: 'Animal',
  pet: 'Pet', bike: 'Bicicleta', vehicle: 'Veículo', document: 'Documento', jewelry: 'Joia',
  electronics: 'Eletrônico', clothing: 'Roupa', other: 'Outro',
};

/** Emoji só da OPÇÃO do filtro (os pinos do mapa seguem com o mapa de emojis próprio, sem mudança). */
export const CATEGORIA_EMOJI_FILTRO: Readonly<Record<Categoria, string>> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', animal: '🐴', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻', clothing: '👕', other: '📦',
};

const CONHECIDAS = new Set<string>(CATEGORIAS);
export const ehCategoriaConhecida = (v: unknown): v is Categoria => typeof v === 'string' && CONHECIDAS.has(v);

/** Categoria usada para FILTRAR: a conhecida como está; «book», nula e qualquer valor desconhecido (ex.: «found», «lost») valem «other». O dado não muda. */
export function categoriaParaFiltro(raw: string | null | undefined): Categoria {
  const k = (raw ?? '').trim().toLowerCase();
  return ehCategoriaConhecida(k) ? k : 'other';
}

/** A categoria e todas as suas mães (da mais específica para a mais geral). Ex.: pet → [pet, animal]; phone → [phone, electronics]. */
export function categoriaEAscendentes(c: Categoria): Categoria[] {
  const out: Categoria[] = [c];
  for (let m = CATEGORIA_MAE[c]; m && !out.includes(m); m = CATEGORIA_MAE[m]) out.push(m);
  return out;
}

/** Categorias do BANCO que o filtro `filtro` mostra: a própria e as filhas. Ex.: animal → [animal, pet]; electronics → [electronics, phone]; pet → [pet]; phone → [phone]. */
export function categoriasDoFiltro(filtro: Categoria): Categoria[] {
  return CATEGORIAS.filter((c) => categoriaEAscendentes(c).includes(filtro));
}

/**
 * Categorias do BANCO que uma LISTA (admin, relatórios, busca do painel) mostra ao filtrar por `categoria`.
 * Decisão do fundador (24/11/2026): só Animal inclui Pet (animal → [animal, pet]); Pet mostra só pet; as demais mostram só a própria
 * (Eletrônico NÃO inclui Celular nas listas, igual ao que já era). Valor vazio ou desconhecido → só ele mesmo (comportamento anterior).
 */
export function categoriasDaLista(categoria: string): string[] {
  return categoria === 'animal' ? ['animal', 'pet'] : [categoria];
}

/** O item de categoria `raw` aparece no filtro `filtro`? Filtro vazio = todos. Mãe inclui filhas; filha NUNCA inclui a mãe nem as irmãs (Pet não mostra «animal»). */
export function pertenceAoFiltro(raw: string | null | undefined, filtro: string): boolean {
  if (!filtro) return true;
  if (!ehCategoriaConhecida(filtro)) return (raw ?? '') === filtro;
  return categoriaEAscendentes(categoriaParaFiltro(raw)).includes(filtro);
}

/** Opções do filtro de categoria, na ordem da tela. */
export const OPCOES_FILTRO_CATEGORIA: ReadonlyArray<{ valor: Categoria; rotulo: string; emoji: string }> =
  CATEGORIAS.map((valor) => ({ valor, rotulo: CATEGORIA_ROTULO[valor], emoji: CATEGORIA_EMOJI_FILTRO[valor] }));

/** Rótulo para exibir (lista e detalhe): categoria conhecida pelo nome; qualquer outra, «Outro». */
export const rotuloDaCategoria = (raw: string | null | undefined): string => CATEGORIA_ROTULO[categoriaParaFiltro(raw)];
