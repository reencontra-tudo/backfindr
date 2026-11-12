// Local no Feed: texto para exibir (só bairro/cidade, NUNCA rua/número/CEP) e chaves de região.
//
// Escolha de abordagem (a mais simples e coerente com o que já existe): o local dos objetos é texto livre
// (objects.location), então a cidade/UF vêm do TEXTO; quando o texto não traz cidade e a ocorrência tem
// coordenada própria, usa-se a tabela `municipalities` (centro + raio_km, distância de Haversine) só para
// descobrir a cidade. Nenhuma coordenada sai na resposta e nenhuma distância é exibida na Fase 1.
export const NO_LOCATION_LABEL = 'Local não informado';

export const UF_CODES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// «São Paulo» e «Rio de Janeiro» ficam de fora de propósito: são nome de cidade E de estado; o texto sozinho não decide.
const UF_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries({
    'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE',
    'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT',
    'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR',
    'pernambuco': 'PE', 'piaui': 'PI', 'rio grande do norte': 'RN',
    'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
    'sergipe': 'SE', 'tocantins': 'TO',
  }),
);

const STREET_PREFIX = /^(rua|r\.|av\.?|avenida|travessa|tv\.?|alameda|al\.|estrada|rodovia|rod\.|br[- ]?\d|pra[cç]a|largo|via|beco|viela|quadra|qd\.?|lote|lt\.?|conjunto|bloco|km)\b/i;
const looksLikeStreet = (seg: string) => /\d/.test(seg) || STREET_PREFIX.test(seg.trim());

export interface ParsedLocation {
  /** Texto seguro para exibir («Bairro, Cidade - UF»), ou «Local não informado». */
  label: string;
  /** Cidade normalizada (sem acento, minúscula) quando o texto traz cidade e bairro/UF. */
  cityNorm: string | null;
  /** Único trecho restante quando não dá para saber se é cidade ou bairro (comparado com a cidade do visitante). */
  singleNorm: string | null;
  uf: string | null;
}

export function parseLocation(text: string | null | undefined): ParsedLocation {
  let raw = (text ?? '').trim();
  if (raw.startsWith('{')) { // alguns registros guardam JSON em objects.location
    try { const j = JSON.parse(raw); raw = typeof j?.address === 'string' ? j.address : ''; } catch { raw = ''; }
  }
  const segments = raw.split(/\s*[,/]\s*|\s+-\s*/).map((s) => s.trim()).filter(Boolean);
  let uf: string | null = null;
  const kept: string[] = [];
  for (const seg of segments) {
    const n = norm(seg);
    if (n === 'brasil' || n === 'brazil') continue;
    if (/^[\d.\-\s]+$/.test(seg)) continue; // CEP
    if (seg.length === 2 && seg === seg.toUpperCase() && UF_CODES.has(seg)) { uf = seg; continue; }
    if (UF_BY_NAME[n]) { uf = UF_BY_NAME[n]; continue; }
    if (looksLikeStreet(seg)) continue;
    kept.push(seg.replace(/^bairro\s+/i, ''));
  }
  if (kept.length === 0) return { label: NO_LOCATION_LABEL, cityNorm: null, singleNorm: null, uf };
  const last2 = kept.slice(-2);
  const label = last2.join(', ') + (uf ? ` - ${uf}` : '');
  if (kept.length >= 2) return { label, cityNorm: norm(kept[kept.length - 1]), singleNorm: null, uf };
  return { label, cityNorm: uf ? norm(kept[0]) : null, singleNorm: norm(kept[0]), uf };
}

export interface Municipality { name: string; state_code: string; latitude: number; longitude: number; radius_km: number }

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Cidade mais próxima cujo raio contém a coordenada (só como alternativa quando o texto não traz cidade). */
export function cityFromCoordinates(lat: number, lng: number, municipalities: Municipality[]): Municipality | null {
  let best: Municipality | null = null, bestD = Infinity;
  for (const m of municipalities) {
    const d = haversineKm(lat, lng, m.latitude, m.longitude);
    if (d <= m.radius_km && d < bestD) { best = m; bestD = d; }
  }
  return best;
}

export interface Visitor { cityNorm: string | null; uf: string | null; scope: 'estado' | 'cidade' }

/** Faixa da ocorrência para o visitante: 0 = mesma cidade, 1 = mesma região/estado, null = outra região (fora do Feed). */
export function bandFor(item: { cityNorm: string | null; singleNorm: string | null; uf: string | null }, v: Visitor): 0 | 1 | null {
  const sameUf = !v.uf || !item.uf || item.uf === v.uf;
  if (v.cityNorm && (item.cityNorm === v.cityNorm || item.singleNorm === v.cityNorm) && sameUf) return 0;
  if (v.scope === 'cidade') return null;
  if (v.uf && item.uf === v.uf) return 1;
  return null;
}
