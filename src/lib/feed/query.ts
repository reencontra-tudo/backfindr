// Leitura do Feed (somente leitura). Colunas FIXAS, sem SELECT *, sem JOIN com matches, sem LIKE de texto.
// O que sai daqui para fora (toPublicItem) é uma lista fixa de campos: nunca owner_id/user_id, telefone,
// e-mail, endereço exato, coordenadas, descrição bruta, contact_snapshot, match ou score.
import { query } from '@/lib/db';
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';
import { feedCategoryKey, FEED_CATEGORY_LABELS, isFeedCategoryKey, type FeedCategoryKey } from './category';
import { parseLocation, cityFromCoordinates, bandFor, norm, UF_CODES, NO_LOCATION_LABEL, type Municipality, type Visitor } from './location';
import { rankFeed } from './order';
import { STATUS_LABELS } from './time';

export const FEED_PAGE_SIZE = 12;
/** Teto de segurança de linhas lidas por consulta. Se for atingido, a resposta diz (truncated) e o log avisa. */
export const FEED_MAX_CANDIDATES = 1000;
const CACHE_TTL_MS = 120_000;

export type FeedStatus = 'lost' | 'found' | 'stolen';

/** Campos públicos de um card — lista FIXA. */
export interface FeedItem {
  code: string;
  title: string;
  status: FeedStatus;
  status_label: string;
  category: FeedCategoryKey;
  category_label: string;
  origin: 'usuario' | 'sinal_publico';
  location_label: string;
  has_photo: boolean;
  photo_url: string | null;
  created_at: string;
  source_url: string | null;
  source_name: string | null;
  can_report_found: boolean;
}

interface FeedRow extends FeedItem {
  createdAtMs: number;
  boosted: boolean;
  cityNorm: string | null;
  singleNorm: string | null;
  uf: string | null;
}

export function toPublicItem(r: FeedRow): FeedItem {
  return {
    code: r.code, title: r.title, status: r.status, status_label: r.status_label,
    category: r.category, category_label: r.category_label, origin: r.origin,
    location_label: r.location_label, has_photo: r.has_photo, photo_url: r.photo_url,
    created_at: r.created_at, source_url: r.source_url, source_name: r.source_name,
    can_report_found: r.can_report_found,
  };
}

export function sourceName(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === 'news.google.com' ? 'Google Notícias' : h;
  } catch { return null; }
}

/**
 * Regra de elegibilidade do Feed (FONTE ÚNICA): a leitura do Feed e a contagem do admin usam este mesmo trecho,
 * para o número do admin nunca divergir do que o Feed pode mostrar. Sem legado.
 */
export const FEED_ELIGIBILITY_WHERE = `o.is_public = true
     AND o.is_legacy = false
     AND o.status IN ('lost', 'found', 'stolen')
     AND o.qr_code IS NOT NULL`;

export const FEED_SQL = `
  SELECT o.qr_code AS code, o.title, o.status, o.category, o.type,
         o.location AS location_text, o.latitude, o.longitude, o.source, o.created_at,
         (o.is_boosted = true AND (o.boost_expires_at IS NULL OR o.boost_expires_at > NOW())) AS boosted,
         CASE WHEN left(o.images->>0, 8) = 'https://' THEN o.images->>0 END AS photo_url,
         ev.source_url
    FROM objects o
    LEFT JOIN LATERAL (
      SELECT e.source_url FROM public_signal_evidence e
       WHERE o.source = 'public_signal' AND e.object_id = o.id AND e.status = 'approved'
         AND left(e.source_url, 4) = 'http'
       ORDER BY e.created_at DESC LIMIT 1
    ) ev ON true
   WHERE ${FEED_ELIGIBILITY_WHERE}
   ORDER BY o.created_at DESC, o.id
   LIMIT $1`;

interface Loaded { at: number; rows: FeedRow[]; truncated: boolean }
let memo: Loaded | null = null;
export function resetFeedCache() { memo = null; }

async function loadMunicipalities(): Promise<Municipality[]> {
  try {
    const r = await query(
      `SELECT name, state_code, latitude, longitude, COALESCE(radius_km, 25) AS radius_km
         FROM municipalities WHERE latitude IS NOT NULL AND longitude IS NOT NULL`);
    return r.rows.map((m: any) => ({
      name: m.name, state_code: String(m.state_code).trim(),
      latitude: Number(m.latitude), longitude: Number(m.longitude), radius_km: Number(m.radius_km),
    }));
  } catch (e) {
    console.warn('[feed] municipalities indisponível; cidade só pelo texto do local', e);
    return [];
  }
}

async function load(): Promise<Loaded> {
  if (memo && Date.now() - memo.at < CACHE_TTL_MS) return memo;
  const [res, munis] = await Promise.all([query(FEED_SQL, [FEED_MAX_CANDIDATES + 1]), loadMunicipalities()]);
  const truncated = res.rows.length > FEED_MAX_CANDIDATES;
  if (truncated) console.warn(`[feed] teto de ${FEED_MAX_CANDIDATES} candidatos atingido; as mais antigas ficaram de fora desta leitura`);
  const muniByName = new Map(munis.map((m) => [norm(m.name), m]));

  const rows: FeedRow[] = res.rows.slice(0, FEED_MAX_CANDIDATES).map((r: any) => {
    const loc = parseLocation(r.location_text);
    let { cityNorm, uf } = loc;
    const lat = r.latitude != null ? Number(r.latitude) : NaN;
    const lng = r.longitude != null ? Number(r.longitude) : NaN;
    if (!cityNorm && Number.isFinite(lat) && Number.isFinite(lng)) { // texto sem cidade: usa a coordenada própria (se houver)
      const m = cityFromCoordinates(lat, lng, munis);
      if (m) { cityNorm = norm(m.name); uf = uf ?? m.state_code; }
    }
    if (!uf) { const m = muniByName.get(cityNorm ?? loc.singleNorm ?? ''); if (m) uf = m.state_code; }
    const catKey = feedCategoryKey(r.category ?? r.type);
    const origin = r.source === 'public_signal' ? 'sinal_publico' : 'usuario';
    const status = r.status as FeedStatus;
    const url = origin === 'sinal_publico' ? (r.source_url ?? null) : null;
    const created = new Date(r.created_at);
    return {
      code: String(r.code),
      title: maskPersonNames(r.title) || 'Ocorrência sem título',
      status, status_label: STATUS_LABELS[status] ?? '',
      category: catKey, category_label: FEED_CATEGORY_LABELS[catKey],
      origin,
      location_label: maskPersonNames(loc.label) || NO_LOCATION_LABEL,
      has_photo: Boolean(r.photo_url), photo_url: r.photo_url ?? null,
      created_at: created.toISOString(),
      source_url: url, source_name: sourceName(url),
      can_report_found: origin === 'usuario' && (status === 'lost' || status === 'stolen'),
      createdAtMs: created.getTime(), boosted: Boolean(r.boosted),
      cityNorm, singleNorm: loc.singleNorm, uf,
    };
  });
  memo = { at: Date.now(), rows, truncated };
  return memo;
}

export interface FeedParams {
  status?: string | null;      // all | lost | found | stolen
  category?: string | null;    // all | pet | document | ...
  city?: string | null;        // cidade do visitante (nunca guardada)
  uf?: string | null;          // UF do visitante
  scope?: string | null;       // 'cidade' = só a cidade; padrão = cidade e depois o estado
}

export interface RankedFeed {
  items: FeedRow[];
  truncated: boolean;
  locationApplied: boolean;
  ufs: string[];
}

export function parseFeedParams(sp: URLSearchParams): FeedParams {
  return { status: sp.get('status'), category: sp.get('categoria') ?? sp.get('category'), city: sp.get('cidade'), uf: sp.get('uf'), scope: sp.get('escopo') };
}

function cleanCity(c: string | null | undefined): string | null {
  if (!c) return null;
  const t = c.trim().slice(0, 60);
  if (!/^[\p{L}\s.'’-]{2,60}$/u.test(t)) return null;
  return norm(t);
}

export async function getRankedFeed(p: FeedParams = {}): Promise<RankedFeed> {
  const { rows, truncated } = await load();
  const status = p.status && ['lost', 'found', 'stolen'].includes(p.status) ? p.status : null;
  const cat = p.category && isFeedCategoryKey(p.category) ? p.category : null;
  const uf = p.uf && UF_CODES.has(p.uf.toUpperCase()) ? p.uf.toUpperCase() : null;
  const visitor: Visitor = { cityNorm: cleanCity(p.city), uf, scope: p.scope === 'cidade' ? 'cidade' : 'estado' };
  const locationApplied = Boolean(visitor.cityNorm || visitor.uf);

  const ufs = [...new Set(rows.map((r) => r.uf).filter((u): u is string => !!u))].sort();
  const picked: Array<FeedRow & { band: number; hasPhoto: boolean }> = [];
  for (const r of rows) {
    if (status && r.status !== status) continue;
    if (cat && r.category !== cat) continue;
    let band = 0;
    if (locationApplied) {
      const b = bandFor(r, visitor);
      if (b === null) continue; // NUNCA preenche com outras regiões
      band = b;
    }
    picked.push({ ...r, band, hasPhoto: r.has_photo });
  }
  return { items: rankFeed(picked), truncated, locationApplied, ufs };
}

// ── Cursor opaco: posição + código do último card. Se a lista mudou entre duas páginas, o código
// do último card reposiciona a leitura (sem repetir nem pular cards já vistos). ─────────────────────
export function encodeCursor(position: number, lastCode: string): string {
  return Buffer.from(JSON.stringify({ p: position, c: lastCode })).toString('base64url');
}
export function decodeCursor(raw: string | null | undefined): { p: number; c: string } | null {
  if (!raw || raw.length > 200) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (Number.isInteger(j?.p) && j.p >= 0 && j.p < 100_000 && typeof j?.c === 'string' && j.c.length <= 64) return { p: j.p, c: j.c };
  } catch { /* cursor inválido */ }
  return null;
}

export interface FeedPage { items: FeedItem[]; nextCursor: string | null; hasMore: boolean }

export function pageAfterCursor(ranked: FeedRow[], cursor: { p: number; c: string } | null, size = FEED_PAGE_SIZE): FeedPage {
  let start = 0;
  if (cursor) {
    const idx = ranked.findIndex((r) => r.code === cursor.c);
    start = idx >= 0 ? idx + 1 : Math.min(cursor.p + 1, ranked.length);
  }
  return slice(ranked, start, size);
}

/** Página numerada (links «Ver mais» sem JavaScript). page ≥ 1. */
export function pageByNumber(ranked: FeedRow[], page: number, size = FEED_PAGE_SIZE): FeedPage {
  return slice(ranked, (page - 1) * size, size);
}

function slice(ranked: FeedRow[], start: number, size: number): FeedPage {
  const part = ranked.slice(start, start + size);
  const hasMore = start + size < ranked.length;
  const last = part[part.length - 1];
  return {
    items: part.map(toPublicItem), hasMore,
    nextCursor: hasMore && last ? encodeCursor(start + part.length - 1, last.code) : null,
  };
}
