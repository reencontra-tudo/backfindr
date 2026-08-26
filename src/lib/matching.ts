// ─── Score de compatibilidade entre dois objetos (perdido × achado) ────────
// Consolidado em 26/08/2026 a partir de 3 cópias que já haviam divergido:
// matching/run/route.ts (individual, dono aciona), admin/matching/run-all/
// route.ts ("Rodar matching" no painel admin) e cron/matching/route.ts
// (agendado). As 3 tinham calculateMatchScore/calculateScore quase iguais,
// mas não idênticas — matching/run/route.ts tinha sinônimos + score de
// descrição que os outros dois não tinham, e admin/matching/run-all/
// route.ts tinha bônus de marca (+10) que os outros dois não tinham.
//
// Esta consolidação NÃO muda comportamento ainda — as opções abaixo
// reproduzem exatamente o que cada chamador já fazia antes (ver
// options passadas em cada route.ts). Mudança de lógica (categoria virar
// filtro obrigatório em vez de peso) é um passo separado, posterior.

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
// Usado só quando options.synonyms = true (hoje: só matching/run/route.ts).
const SINONIMOS: Record<string, string[]> = {
  bolsa: ['mochila', 'sacola', 'bag', 'pochete', 'carteira', 'maleta', 'pasta'],
  mochila: ['bolsa', 'sacola', 'bag', 'morral', 'saco'],
  sacola: ['bolsa', 'mochila', 'bag', 'saco'],
  celular: ['telefone', 'smartphone', 'iphone', 'android', 'aparelho', 'samsung', 'motorola'],
  telefone: ['celular', 'smartphone', 'aparelho'],
  carteira: ['wallet', 'bolsa', 'porta-documentos', 'porta documentos'],
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
  onibus: ['bus', 'coletivo', 'transporte'],
  trem: ['metro', 'metrô', 'subway'],
  tablet: ['ipad', 'kindle', 'leitor'],
  fone: ['fones', 'headphone', 'earphone', 'airpod', 'auricular', 'headset'],
  headphone: ['fone', 'fones', 'earphone', 'airpod', 'auricular'],
};

function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  // Remove plural simples: 's' final em palavras com mais de 4 letras
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

function tokenizar(text: string): string[] {
  return removerAcentos(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function expandirTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    const norm = normalizarPalavra(token);
    expanded.add(norm);
    const sinonimos = SINONIMOS[norm] || [];
    for (const s of sinonimos) expanded.add(normalizarPalavra(s));
  }
  return expanded;
}

// ─── Cálculo de distância (Haversine) ──────────────────────────────────────
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface MatchScoreOptions {
  // true só em matching/run/route.ts (dono aciona manualmente) — expande
  // sinônimos no título e pontua sobreposição de descrição.
  synonyms?: boolean;
  description?: boolean;
  // true só em admin/matching/run-all/route.ts ("Rodar matching" no painel).
  brand?: boolean;
}

// ─── Score heurístico (0-100) ──────────────────────────────────────────────
export function calculateMatchScore(
  obj: Record<string, unknown>,
  candidate: Record<string, unknown>,
  options: MatchScoreOptions = {}
): number {
  let score = 0;

  // Categoria (+30)
  const objCat = obj.category || obj.type;
  const canCat = candidate.category || candidate.type;
  if (objCat && canCat && objCat === canCat) score += 30;

  // Distância geográfica
  const lat1 = parseFloat(obj.latitude as string);
  const lon1 = parseFloat(obj.longitude as string);
  const lat2 = parseFloat(candidate.latitude as string);
  const lon2 = parseFloat(candidate.longitude as string);
  if (!isNaN(lat1) && !isNaN(lat2)) {
    const distKm = haversineKm(lat1, lon1, lat2, lon2);
    if (distKm <= 2) score += 40;
    else if (distKm <= 10) score += 30;
    else if (distKm <= 25) score += 15;
    else if (distKm <= 50) score += 5;
  } else {
    score += 15; // sem localização, benefício da dúvida
  }

  // Título
  if (options.synonyms) {
    // matching/run/route.ts: tokeniza (len>2) + expande sinônimos dos dois lados
    if (obj.title && candidate.title) {
      const w1 = expandirTokens(tokenizar(obj.title as string));
      const w2 = expandirTokens(tokenizar(candidate.title as string));
      const common = [...w1].filter(w => w2.has(w)).length;
      if (common > 0) score += Math.min(20, common * 7);
    }
  } else {
    // admin/matching/run-all e cron/matching: split simples, len>3, sem sinônimo
    const objWords = String(obj.title || '').toLowerCase().split(/\s+/).filter(Boolean);
    const canWords = String(candidate.title || '').toLowerCase().split(/\s+/).filter(Boolean);
    const commonWords = objWords.filter(w => w.length > 3 && canWords.includes(w));
    if (commonWords.length > 0) score += Math.min(20, commonWords.length * 7);
  }

  // Descrição — só matching/run/route.ts (options.description = true)
  if (options.description && obj.description && candidate.description) {
    const w1 = tokenizar(obj.description as string);
    const w2 = expandirTokens(tokenizar(candidate.description as string));
    const w1Expanded = expandirTokens(w1);
    const common = [...w1Expanded].filter(w => w2.has(w)).length;
    score += Math.min(10, (common / Math.max(w1.length, 1)) * 10);
  }

  // Cor
  if (options.synonyms) {
    // matching/run/route.ts normaliza (remove acento/caixa) antes de comparar
    if (obj.color && candidate.color) {
      const c1 = normalizarPalavra(obj.color as string);
      const c2 = normalizarPalavra(candidate.color as string);
      if (c1 === c2) score += 10;
    }
  } else {
    // admin/matching/run-all e cron/matching comparam direto, sem normalizar
    if (obj.color && candidate.color && obj.color === candidate.color) score += 10;
  }

  // Marca — só admin/matching/run-all/route.ts (options.brand = true)
  if (options.brand && obj.brand && candidate.brand && obj.brand === candidate.brand) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}
