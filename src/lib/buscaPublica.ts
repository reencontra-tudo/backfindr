import { categoriasDaBusca, construirDicionario, construirNovos, termosConhecidos } from './buscaDicionario';
import { palavrasDeIdentificacao } from '@/lib/flowMatch/relevance';

// Busca pública por texto: dicionário de sinônimos, expansão de termos, condições SQL e score de relevância.
// MOVIDO sem alteração de /api/v1/objects/public (que continua usando estas funções) para que o Feed use a MESMA lógica (sem motor novo).

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
export const SINONIMOS: Record<string, string[]> = {
  bolsa: ['mochila', 'sacola', 'bag', 'pochete', 'carteira', 'maleta', 'pasta'],
  mochila: ['bolsa', 'sacola', 'bag', 'morral', 'saco'],
  sacola: ['bolsa', 'mochila', 'bag', 'saco'],
  celular: ['telefone', 'smartphone', 'iphone', 'android', 'aparelho', 'samsung', 'motorola'],
  telefone: ['celular', 'smartphone', 'aparelho'],
  carteira: ['wallet', 'bolsa', 'porta-documentos'],
  chave: ['chaves', 'chaveiro', 'key'],
  oculos: ['lentes', 'armacao', 'grau', 'sol'],
  notebook: ['computador', 'laptop', 'note', 'mac', 'macbook'],
  computador: ['notebook', 'laptop', 'pc', 'desktop'],
  caderno: ['cadernos', 'agenda', 'livro', 'bloco', 'diario'],
  agenda: ['caderno', 'livro', 'bloco', 'diario'],
  cachorro: ['cao', 'dog', 'pet', 'animal', 'canino'],
  cao: ['cachorro', 'dog', 'pet', 'animal'],
  gato: ['cat', 'felino', 'pet', 'animal', 'gatinho'],
  relogio: ['watch', 'smartwatch', 'cronometro'],
  documento: ['documentos', 'rg', 'cpf', 'identidade', 'passaporte', 'habilitacao', 'cnh'],
  identidade: ['rg', 'documento', 'cpf', 'passaporte'],
  tablet: ['ipad', 'kindle', 'leitor'],
  fone: ['fones', 'headphone', 'earphone', 'airpod', 'auricular', 'headset'],
  headphone: ['fone', 'fones', 'earphone', 'airpod', 'auricular'],
  onibus: ['bus', 'coletivo', 'transporte'],
  trem: ['metro', 'subway'],
};

export function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

/** Dicionário AMPLIADO (src/lib/buscaDicionario.ts): só as consumidoras de busca que pedirem (`dicionario: 'ampliado'`). O `SINONIMOS` acima fica CONGELADO. */
export const DICIONARIO_AMPLIADO = construirDicionario(SINONIMOS, normalizarPalavra);
const CONHECIDOS = termosConhecidos(DICIONARIO_AMPLIADO, normalizarPalavra);
/** Só os pares NOVOS (grupos e relações): reconhecem, no TEXTO da ocorrência, uma palavra que a busca pediu (ex.: «carro» → «chevrolet»). */
const NOVOS_AMPLIADO = construirNovos(normalizarPalavra);

/** `o?.dicionario === 'ampliado'`: separa por qualquer pontuação («carro,» vira «carro») e não descarta palavras curtas conhecidas («rg»). Sem opção: igual a sempre. */
export function tokenizar(text: string, o?: OpcoesBusca): string[] {
  if (o?.dicionario === 'ampliado') {
    return removerAcentos(text).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 || CONHECIDOS.has(normalizarPalavra(w)));
  }
  return removerAcentos(text).toLowerCase().split(/\s+/).filter(w => w.length > 2);
}

/** Opções DESLIGADAS por padrão (os consumidores antigos — home, mapa, /achei, fluxos — continuam exatamente como eram). Só a busca do Feed liga.
 *  radical: o dicionário tem chaves como «oculos» e «onibus», mas `normalizarPalavra` tira o «s» final («oculo»/«onibu»), então a chave NUNCA casava.
 *           Com a opção, a busca no dicionário também usa o radical de cada chave.
 *  semAcento: casa título/descrição sem diferenciar acento («oculos» acha «Óculos»).
 *  dicionario: 'ampliado' usa DICIONARIO_AMPLIADO (chaves já normalizadas, então não precisa de `radical`) e reconhece CATEGORIA:
 *           uma palavra como «carro» acha toda ocorrência de categoria Veículo (nota +20, candidata no SQL). */
export interface OpcoesBusca { radical?: boolean; semAcento?: boolean; dicionario?: 'ampliado'; categoriasDaBusca?: string[] }

/** Categorias do banco pedidas pelas palavras da busca (só com o dicionário ampliado). */
export function categoriasDaBuscaTexto(keyword: string, o?: OpcoesBusca): string[] {
  if (o?.dicionario !== 'ampliado') return [];
  return categoriasDaBusca(tokenizar(keyword, o).map(normalizarPalavra), normalizarPalavra);
}

const POR_RADICAL: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(SINONIMOS)) m[normalizarPalavra(k)] = [...(m[normalizarPalavra(k)] ?? []), ...v];
  return m;
})();
const sinonimosDe = (norm: string, o?: OpcoesBusca): string[] => o?.dicionario === 'ampliado' ? (DICIONARIO_AMPLIADO[norm] ?? []) : (o?.radical ? (SINONIMOS[norm] ?? POR_RADICAL[norm]) : SINONIMOS[norm]) || [];

export function expandirTokens(tokens: string[], o?: OpcoesBusca): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const norm = normalizarPalavra(token);
    expanded.add(norm);
    for (const s of sinonimosDe(norm, o)) expanded.add(normalizarPalavra(s));
  }
  return expanded;
}

export function expandirKeyword(keyword: string, o?: OpcoesBusca): string[] {
  const termos = new Set<string>();
  termos.add(keyword.toLowerCase().trim());
  const palavras = o?.dicionario === 'ampliado' ? tokenizar(keyword, o) : removerAcentos(keyword).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  for (const palavra of palavras) {
    const norm = normalizarPalavra(palavra);
    termos.add(norm);
    for (const s of sinonimosDe(norm, o)) termos.add(s);
  }
  return [...termos];
}

export function buildKeywordConditions(termosExpandidos: string[], params: unknown[], o?: OpcoesBusca): string {
  const conds: string[] = [];
  for (const termo of termosExpandidos) {
    params.push(`%${termo}%`);
    const p = params.length;
    const col = (c: string) => (o?.semAcento ? `translate(LOWER(${c}), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')` : `LOWER(${c})`);
    conds.push(
      `(${col('title')} LIKE $${p} OR ${col('description')} LIKE $${p}` +
      ` OR ${col('color')} LIKE $${p} OR ${col('brand')} LIKE $${p} OR ${col('breed')} LIKE $${p})`
    );
  }
  // Reconhecimento por categoria (só com o dicionário ampliado): «carro» entra como candidata toda ocorrência de categoria Veículo
  if (o?.dicionario === 'ampliado' && o.categoriasDaBusca?.length) {
    params.push(o.categoriasDaBusca);
    conds.push(`LOWER(category) = ANY($${params.length}::text[])`);
  }
  return `(${conds.join(' OR ')})`;
}

// ─── Score de relevância pós-query (mesma lógica do matching) ─────────────
// Threshold mínimo para aparecer na busca pública
export const SCORE_MIN_BUSCA = 20;

/** Palavras do título/descrição. No dicionário ampliado o ITEM NÃO é expandido (só a busca): senão «chevrolet» listaria todo texto com «carro», porque «carro» expande para «chevrolet». */
const itemTokens = (texto: string, o?: OpcoesBusca): Set<string> =>
  o?.dicionario === 'ampliado' ? new Set(tokenizar(texto, o).map(normalizarPalavra)) : expandirTokens(tokenizar(texto, o), o);

export function calcularScoreBusca(keyword: string, item: Record<string, unknown>, o?: OpcoesBusca): number {
  let score = 0;

  const kwTokens = tokenizar(keyword, o);
  const kwExpanded = expandirTokens(kwTokens, o);

  // Título com sinônimos (+10 por palavra, até 40 pts)
  if (item.title) {
    const titleTokens = itemTokens(item.title as string, o);
    const common = [...kwExpanded].filter(w => titleTokens.has(w)).length;
    if (common > 0) score += Math.min(40, common * 10);
  }

  // Descrição com sinônimos (até 20 pts)
  if (item.description) {
    const descTokens = itemTokens(item.description as string, o);
    const common = [...kwExpanded].filter(w => descTokens.has(w)).length;
    score += Math.min(20, (common / Math.max(kwTokens.length, 1)) * 20);
  }

  // Cor coincide (+15)
  if (item.color) {
    const kwColors = kwTokens.map(normalizarPalavra);
    const itemColor = normalizarPalavra(item.color as string);
    if (kwColors.includes(itemColor)) score += 15;
  }

  // Categoria / tipo coincide com keyword (+10)
  if (item.category || item.type) {
    const cat = normalizarPalavra((item.category || item.type) as string);
    if ([...kwExpanded].includes(cat)) score += 10;
  }

  // Reconhecimento por categoria (só com o dicionário ampliado): «carro»/«moto»/«veiculo» → categoria Veículo (+20, já alcança a nota mínima)
  if (o?.dicionario === 'ampliado') {
    const cats = o.categoriasDaBusca ?? categoriasDaBuscaTexto(keyword, o);
    const cat = String(item.category ?? item.type ?? '').toLowerCase();
    if (cat && cats.includes(cat) && !item.is_legacy) score += 20; // legado fica de fora: milhares de registros antigos inundariam a lista só pela categoria
  }

  return Math.min(100, Math.round(score));
}


// ─── Nível de entrada (só com o dicionário ampliado; Feed e /achei `amplo=1`) ──────────────────────────────
//   0 = palavra EXATA: uma palavra que identifica o objeto (sem cor, palavra vazia nem descrição genérica) aparece INTEIRA no título/descrição;
//   1 = termo NOVO do dicionário (grupo/relação) que a busca pediu aparece inteiro no título/descrição (ex.: «carro» → «Chevrolet Spin»), ou a categoria
//       pedida (hoje só «veiculo» pede vehicle; nunca legado);
//   2 = nota >= SCORE_MIN_BUSCA (sinônimos antigos, com o radical corrigido).
// A nota só ordena dentro do nível. Sem este nível, «carro» (10 pontos por palavra) não achava «Spin» sozinho no título.
export type NivelBusca = 0 | 1 | 2;
const palavrasDoTexto = (t: unknown): Set<string> => new Set(removerAcentos(String(t ?? '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(normalizarPalavra));

export function nivelBuscaAmpliada(keyword: string, item: Record<string, unknown>, nota: number, o?: OpcoesBusca): NivelBusca | null {
  const palavras = palavrasDoTexto(`${item.title ?? ''} ${item.description ?? ''} ${item.brand ?? ''}`); // `model` não entra: em produção nenhuma ocorrência elegível o tem preenchido (e a busca SQL também não olha)
  if (palavrasDeIdentificacao(keyword).some((w) => palavras.has(w))) return 0;
  const pedidas = tokenizar(keyword, { dicionario: 'ampliado' }).map(normalizarPalavra);
  const novas = new Set<string>();
  for (const t of pedidas) for (const s of NOVOS_AMPLIADO[t] ?? []) novas.add(normalizarPalavra(s));
  for (const t of pedidas) novas.delete(t);
  if ([...novas].some((w) => palavras.has(w))) return 1;
  const cats = o?.categoriasDaBusca ?? categoriasDaBuscaTexto(keyword, { dicionario: 'ampliado' });
  const cat = String(item.category ?? item.type ?? '').toLowerCase();
  if (!item.is_legacy && cat && cats.includes(cat)) return 1;
  return nota >= SCORE_MIN_BUSCA ? 2 : null;
}

/** Quantas palavras exatas da busca o texto tem (desempate dentro do nível 0). */
export function palavrasExatasBusca(keyword: string, item: Record<string, unknown>): number {
  const palavras = palavrasDoTexto(`${item.title ?? ''} ${item.description ?? ''}`);
  return palavrasDeIdentificacao(keyword).filter((w) => palavras.has(w)).length;
}
