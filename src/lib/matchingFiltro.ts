// Filtro ÚNICO do matching, reutilizado pelo cron, pelo gancho de criação (que chama /matching/run), pela rota individual e pelo run-all do administrador.
//
// REGRA A — só objetos NOVOS disparam o matching automático: cadastrados (created_at) depois de MATCHING_DESDE. Objetos antigos não são gatilho.
// REGRA B — candidatos nunca são do legado: nem o objeto marcado como legado, nem objeto de DONO legado. (Conta de sistema — sinais públicos — não é legada e segue como candidata.)
// REGRA C — a ordem das datas é a da OCORRÊNCIA (occurrence_date: quando a perda/roubo ou o achado ACONTECEU), nunca a do cadastro:
//          um «perdi/roubado» só casa com um «achei» de data POSTERIOR OU IGUAL. Sem data de um dos lados, não há filtro de data nesse par
//          (e created_at nunca substitui a data da ocorrência). Vale no SQL, no estágio heurístico, no semântico e antes de gravar o par.
import { query } from '@/lib/db';

/**
 * Corte da reativação do matching: 16/11/2026 00:00 em America/Sao_Paulo = 03:00 UTC.
 * objects.created_at é «timestamp sem fuso» e o banco grava em UTC (verificado: sessão em UTC e created_at igual ao horário UTC do evento de criação).
 * Usa-se a data de CADASTRO só aqui, porque a pergunta é «o objeto entrou depois da reativação?».
 */
export const MATCHING_DESDE = '2026-11-16T03:00:00Z';
/** Mesmo corte no formato que o banco compara com created_at (UTC, sem fuso). */
export const MATCHING_DESDE_SQL = '2026-11-16 03:00:00';

/** Regra A: o objeto foi cadastrado depois do corte? (created_at pode vir como Date, texto ou nulo.) */
export function objetoEhNovoParaMatching(createdAt: unknown): boolean {
  if (createdAt === null || createdAt === undefined || createdAt === '') return false;
  let ms: number;
  if (createdAt instanceof Date) {
    // pg lê «timestamp sem fuso» como horário LOCAL do processo; reinterpreta os componentes como UTC (o banco grava em UTC)
    ms = Date.UTC(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate(), createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds());
  } else {
    const t = String(createdAt).trim().replace(' ', 'T');
    ms = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`);
  }
  return Number.isFinite(ms) && ms >= Date.parse(MATCHING_DESDE);
}

/** Dia da ocorrência como «AAAA-MM-DD», ou null se não houver. Aceita texto de data ou Date (pg lê DATE como meia-noite LOCAL). */
export function diaDaOcorrencia(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${valor.getFullYear()}-${p(valor.getMonth() + 1)}-${p(valor.getDate())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

interface ComStatusEData { status?: unknown; occurrence_date?: unknown }

/**
 * Regra C: a ordem das datas de OCORRÊNCIA permite este par? Perdido/roubado (lost, stolen) × achado (found).
 * Permite se o achado é do mesmo dia ou posterior; bloqueia se é anterior. Sem data em qualquer lado, ou sem um lado «achado» e outro «perdido»: permite (sem filtro).
 */
export function ordemDeDatasValida(a: ComStatusEData, b: ComStatusEData): boolean {
  const ehAchado = (o: ComStatusEData) => o.status === 'found';
  const ehPerdido = (o: ComStatusEData) => o.status === 'lost' || o.status === 'stolen';
  let perdido: ComStatusEData | null = null; let achado: ComStatusEData | null = null;
  if (ehPerdido(a) && ehAchado(b)) { perdido = a; achado = b; }
  else if (ehAchado(a) && ehPerdido(b)) { perdido = b; achado = a; }
  if (!perdido || !achado) return true;
  const dPerdido = diaDaOcorrencia(perdido.occurrence_date);
  const dAchado = diaDaOcorrencia(achado.occurrence_date);
  if (!dPerdido || !dAchado) return true;
  return dAchado >= dPerdido; // «AAAA-MM-DD» compara certo como texto
}

/** Ponto único antes de gravar um par: hoje só a regra C (as demais já filtram o SQL e o gatilho). */
export function parPodeVirarMatch(a: ComStatusEData, b: ComStatusEData): boolean {
  return ordemDeDatasValida(a, b);
}

// Pedaço de SQL: o dono NÃO é usuário legado (regra B). `alias` é o nome da tabela de objetos na consulta.
const donoNaoLegado = (alias: string) =>
  `NOT EXISTS (SELECT 1 FROM users cu WHERE cu.id = ${alias}.user_id AND cu.is_legacy IS TRUE)`;

export interface OpcoesCandidatos {
  /** Status dos candidatos (ex.: ['found'] para um perdido). */
  statuses: string[];
  categoryGroup: string[] | null;
  maxRadiusKm: number;
  /** Ordem hoje usada por cada caminho: distância (rota individual) ou data de cadastro (cron e run-all). */
  ordem: 'distancia' | 'criacao';
  limiteComCoordenada: number;
  limiteSemCoordenada: number;
  /** Sem coordenada e sem categoria: a rota individual busca mesmo assim; o cron e o run-all pulam o objeto. */
  semCategoriaSemCoordenada: 'buscar' | 'pular';
}

/**
 * Consulta de candidatos, a mesma para os quatro caminhos. Mantém o que cada um já fazia (status, categoria, raio, legado, ordem, limites)
 * e acrescenta as regras B (dono não legado) e C (ordem das datas da ocorrência). Devolve null quando o objeto deve ser pulado.
 */
export function montarBuscaDeCandidatos(object: Record<string, unknown>, o: OpcoesCandidatos): { sql: string; params: unknown[] } | null {
  const lat = parseFloat(object.latitude as string);
  const lon = parseFloat(object.longitude as string);
  const temLocal = !Number.isNaN(lat) && !Number.isNaN(lon);
  if (!temLocal && !o.categoryGroup && o.semCategoriaSemCoordenada === 'pular') return null;

  const params: unknown[] = [o.statuses, object.id];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  // Regra C no SQL: com data do objeto-gatilho, o candidato só entra se não tiver data ou se a ordem vale.
  const diaGatilho = diaDaOcorrencia(object.occurrence_date);
  const gatilhoEhAchado = object.status === 'found';
  const gatilhoEhPerdido = object.status === 'lost' || object.status === 'stolen';
  let filtroData = '';
  if (diaGatilho && (gatilhoEhAchado || gatilhoEhPerdido)) {
    const d = p(diaGatilho);
    filtroData = gatilhoEhPerdido
      ? ` AND (occurrence_date IS NULL OR occurrence_date >= ${d}::date)`   // candidato é achado: do mesmo dia ou posterior
      : ` AND (occurrence_date IS NULL OR occurrence_date <= ${d}::date)`;  // candidato é perdido/roubado: do mesmo dia ou anterior
  }
  let filtroCategoria = '';
  if (o.categoryGroup) { const c = p(o.categoryGroup); filtroCategoria = ` AND (category = ANY(${c}) OR type = ANY(${c}))`; }
  const comum = `AND is_legacy = false AND ${donoNaoLegado('objects')}${filtroCategoria}${filtroData}`;

  if (temLocal) {
    const la = p(lat), lo = p(lon), raio = p(o.maxRadiusKm);
    const distancia = `(6371 * acos(LEAST(1.0, cos(radians(${la})) * cos(radians(latitude::float)) * cos(radians(longitude::float) - radians(${lo})) + sin(radians(${la})) * sin(radians(latitude::float)))))`;
    const sql = `SELECT *, ${distancia} AS distance_km FROM objects
      WHERE status = ANY($1) AND id != $2 AND latitude IS NOT NULL AND longitude IS NOT NULL AND ${distancia} <= ${raio} ${comum}
      ORDER BY ${o.ordem === 'distancia' ? 'distance_km ASC' : 'created_at DESC'} LIMIT ${o.limiteComCoordenada}`;
    return { sql, params };
  }
  const sql = `SELECT * FROM objects WHERE status = ANY($1) AND id != $2 ${comum} ORDER BY created_at DESC LIMIT ${o.limiteSemCoordenada}`;
  return { sql, params };
}

/**
 * Gatilhos do cron (regra A): objetos NOVOS (cadastrados depois de MATCHING_DESDE), perdidos, roubados ou achados, de dono não legado (regra B: objeto de usuário legado nunca entra num par automático, nem como gatilho), que ainda NÃO foram processados.
 * «Já processado» = tem evento matching_completed (gravado ao fim de cada rodada do objeto, no cron e na rota individual). Os mais antigos primeiro, para ninguém ficar de fora.
 */
export async function buscarGatilhosDoCron(limite: number): Promise<Record<string, unknown>[]> {
  const r = await query(
    `SELECT * FROM objects o
      WHERE o.status IN ('lost', 'stolen', 'found')
        AND o.is_legacy = false
        AND o.created_at >= $1::timestamp
        AND ${donoNaoLegado('o')}
        AND NOT EXISTS (SELECT 1 FROM object_events e WHERE e.object_id = o.id AND e.type = 'matching_completed')
      ORDER BY o.created_at ASC
      LIMIT ${Math.max(1, Math.floor(limite))}`,
    [MATCHING_DESDE_SQL],
  );
  return r.rows as Record<string, unknown>[];
}
