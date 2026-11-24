// Programa de Colaboradores (E2): feed da página `/@nome`. Consulta PRÓPRIA; não altera o Feed geral (getRankedFeed, FEED_SQL e a memória do Feed
// ficam como estão). Reaproveita a MESMA regra de elegibilidade (FEED_ELIGIBILITY_WHERE: público, sem legado, perdido/achado/roubado, com código QR)
// e a MESMA lista fixa de campos públicos (toPublicItem). Coordenadas, id do dono e o código do colaborador nunca saem daqui.
//
// Ordem: 1) ocorrências cadastradas com o código DESTE colaborador (mais recentes primeiro); 2) ocorrências da região dele (dentro do raio configurado),
// na mesma ordem do Feed geral (usuário antes de sinal público, com foto antes de sem foto, mais recentes). Sem região ou sem raio: só o grupo 1.
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';
import { FEED_ELIGIBILITY_WHERE, sourceName, toPublicItem, type FeedItem, type FeedStatus } from '@/lib/feed/query';
import { feedCategoryKey, FEED_CATEGORY_LABELS } from '@/lib/feed/category';
import { parseLocation, NO_LOCATION_LABEL } from '@/lib/feed/location';
import { rankFeed } from '@/lib/feed/order';
import { STATUS_LABELS } from '@/lib/feed/time';

export const COLAB_FEED_MAX = 24;
const CANDIDATOS_MAX = 400;

type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export interface RegiaoColaborador { lat: number | null; lng: number | null; raioKm: number | null }

export interface FeedDoColaborador {
  /** Ocorrências cadastradas com o código do colaborador (grupo 1), seguidas das da região (grupo 2). No máximo COLAB_FEED_MAX. */
  itens: FeedItem[];
  /** Quantas ocorrências do grupo 1 são visíveis (elegíveis): base da indexação. */
  comCodigo: number;
}

const HAVERSINE_KM = (lat: string, lng: string) =>
  `6371 * 2 * asin(sqrt(power(sin(radians(o.latitude::float8 - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(o.latitude::float8)) * power(sin(radians(o.longitude::float8 - ${lng}) / 2), 2)))`;

export function regiaoValida(r: RegiaoColaborador): r is { lat: number; lng: number; raioKm: number } {
  return r.lat !== null && r.lng !== null && r.raioKm !== null && r.lat >= -90 && r.lat <= 90 && r.lng >= -180 && r.lng <= 180 && r.raioKm >= 1;
}

function paraItem(r: Record<string, unknown>) {
  const loc = parseLocation(r.location_text as string | null);
  const catKey = feedCategoryKey((r.category ?? r.type) as string | null);
  const origin = r.source === 'public_signal' ? ('sinal_publico' as const) : ('usuario' as const);
  const status = r.status as FeedStatus;
  const url = origin === 'sinal_publico' ? ((r.source_url as string | null) ?? null) : null;
  const created = new Date(r.created_at as string);
  return {
    code: String(r.code),
    title: maskPersonNames(r.title as string) || 'Ocorrência sem título',
    status, status_label: STATUS_LABELS[status] ?? '',
    category: catKey, category_label: FEED_CATEGORY_LABELS[catKey],
    origin,
    location_label: maskPersonNames(loc.label) || NO_LOCATION_LABEL,
    has_photo: Boolean(r.photo_url), photo_url: (r.photo_url as string | null) ?? null,
    created_at: created.toISOString(),
    source_url: url, source_name: sourceName(url),
    can_report_found: origin === 'usuario' && (status === 'lost' || status === 'stolen'),
    createdAtMs: created.getTime(), boosted: Boolean(r.boosted),
    doColaborador: Boolean(r.do_colaborador),
    band: 0, hasPhoto: Boolean(r.photo_url),
  };
}

export async function feedDoColaborador(consulta: Consulta, colaboradorId: string, regiao: RegiaoColaborador): Promise<FeedDoColaborador> {
  const comRegiao = regiaoValida(regiao);
  const params: unknown[] = [colaboradorId, CANDIDATOS_MAX];
  let filtroRegiao = 'false';
  if (comRegiao) {
    params.push(regiao.lat, regiao.lng, regiao.raioKm);
    filtroRegiao = `(o.latitude IS NOT NULL AND o.longitude IS NOT NULL AND ${HAVERSINE_KM('$3::float8', '$4::float8')} <= $5::float8)`;
  }
  const r = await consulta(
    `SELECT o.qr_code AS code, o.title, o.status, o.category, o.type, o.location AS location_text, o.source, o.created_at,
            (o.is_boosted = true AND (o.boost_expires_at IS NULL OR o.boost_expires_at > NOW())) AS boosted,
            CASE WHEN left(o.images->>0, 8) = 'https://' THEN o.images->>0 END AS photo_url,
            (o.colaborador_id = $1) AS do_colaborador,
            ev.source_url
       FROM objects o
       LEFT JOIN LATERAL (
         SELECT e.source_url FROM public_signal_evidence e
          WHERE o.source = 'public_signal' AND e.object_id = o.id AND e.status = 'approved'
            AND left(e.source_url, 4) = 'http'
          ORDER BY e.created_at DESC LIMIT 1
       ) ev ON true
      WHERE ${FEED_ELIGIBILITY_WHERE}
        AND (o.colaborador_id = $1 OR ${filtroRegiao})
      ORDER BY o.created_at DESC, o.id
      LIMIT $2`,
    params,
  );
  const todos = r.rows.map(paraItem);
  const doColab = todos.filter((x) => x.doColaborador).sort((a, b) => b.createdAtMs - a.createdAtMs || (a.code < b.code ? -1 : 1));
  const daRegiao = rankFeed(todos.filter((x) => !x.doColaborador));
  const ordenados = [...doColab, ...daRegiao].slice(0, COLAB_FEED_MAX);
  // toPublicItem é a lista FIXA de campos públicos do Feed geral: nada além dela (nem doColaborador) sai daqui.
  return { itens: ordenados.map((x) => toPublicItem(x as unknown as Parameters<typeof toPublicItem>[0])), comCodigo: doColab.length };
}
