// Localização aproximada do visitante para o Feed (só país, sigla do estado e cidade; sem coordenadas).
// Roda no servidor, na rota GET /api/v1/feed/geo. NADA aqui guarda nem registra IP, cidade ou estado
// (nem em banco, nem em log, nem em evento): o resultado só volta para quem perguntou.
//
// Ordem: (1) cabeçalhos de localização que a Vercel já coloca na requisição; (2) reserva: ipapi.co, chamado no
// servidor, só se os cabeçalhos faltarem (ex.: ambiente sem Vercel). Só o Brasil conta: país diferente de BR ou
// sigla que não seja de estado brasileiro vira «não localizado».
import { isIP } from 'node:net';
import { UF_CODES } from './location';

export interface FeedGeo { country: string | null; uf: string | null; city: string | null }
export const NO_GEO: FeedGeo = { country: null, uf: null, city: null };

export function cleanCountry(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export function cleanUf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const u = v.trim().toUpperCase();
  return UF_CODES.has(u) ? u : null;
}

/** O nome da cidade vem codificado (RFC 3986) nos cabeçalhos da Vercel: «S%C3%A3o%20Paulo». */
export function cleanCity(v: unknown, decode = false): string | null {
  if (typeof v !== 'string') return null;
  let t = v;
  if (decode) { try { t = decodeURIComponent(v); } catch { return null; } }
  t = t.trim();
  return t.length <= 60 && /^[\p{L}\s.'’-]{2,60}$/u.test(t) ? t : null; // nome longo demais é recusado, não cortado
}

/** País diferente de BR: devolve só o país. BR sem estado válido: não localizado (sem cidade). */
function onlyBrazil(country: string | null, ufRaw: unknown, cityRaw: unknown, decodeCity: boolean): FeedGeo {
  if (!country) return NO_GEO;
  if (country !== 'BR') return { country, uf: null, city: null };
  const uf = cleanUf(ufRaw);
  if (!uf) return { country: 'BR', uf: null, city: null };
  return { country: 'BR', uf, city: cleanCity(cityRaw, decodeCity) };
}

/** null = cabeçalhos ausentes (aí vale a reserva). Presentes: decide só com eles. */
export function geoFromVercelHeaders(h: Headers): FeedGeo | null {
  const raw = h.get('x-vercel-ip-country');
  if (raw === null || raw.trim() === '') return null;
  return onlyBrazil(cleanCountry(raw), h.get('x-vercel-ip-country-region'), h.get('x-vercel-ip-city'), true);
}

/** Resposta do ipapi.co (JSON). Aceita `country_code` ou `country` (sigla de 2 letras); estado em `region_code`. */
export function geoFromIpapi(d: unknown): FeedGeo {
  if (!d || typeof d !== 'object') return NO_GEO;
  const o = d as Record<string, unknown>;
  if (o.error) return NO_GEO;
  return onlyBrazil(cleanCountry(o.country_code) ?? cleanCountry(o.country), o.region_code, o.city, false);
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

/** IP público do visitante (cabeçalhos do proxy). Só IP válido e NÃO privado; senão null (e a reserva não é chamada). */
export function visitorIp(h: Headers): string | null {
  const raw = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || (h.get('x-real-ip') ?? '').trim();
  const kind = isIP(raw);
  if (!kind) return null;
  if (kind === 4 && PRIVATE_V4.some((r) => r.test(raw))) return null;
  if (kind === 6 && /^(::1?$|f[cd]|fe80)/i.test(raw)) return null;
  return raw;
}
