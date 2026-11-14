// Estado «busca ampla» do passo 2 (strict=1): em vez de lista vazia, até 3 «Registros recentes parecidos».
// Condições (todas): origem usuário ou sinal público (NUNCA legado), criado nos últimos 90 dias (created_at),
// status coerente com o fluxo (o mesmo `status` da chamada), e ao menos 1 palavra de identificação em comum
// (sem cores, palavras vazias nem descrições genéricas). Não usa a pontuação nem sinônimos.
import { query } from '@/lib/db';
import { maskSignalForPublicApi } from '@/lib/objectPublicView';
import { DIAS_REGISTROS_RECENTES, MAX_REGISTROS_RECENTES, temPalavraIdentificadoraEmComum, tituloRecuperado } from './relevance';

type Linha = Record<string, unknown>;

function fotos(images: unknown): unknown[] {
  try {
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') return JSON.parse(images);
    return [];
  } catch { return []; }
}

function local(row: Linha) {
  const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
  const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
  if (lat && lng && !isNaN(lat) && !isNaN(lng)) return { lat, lng, address: (row.location as string) || undefined };
  if (row.location && typeof row.location === 'string') {
    try { const p = JSON.parse(row.location); if (p.lat && p.lng) return p; } catch { /* não é JSON */ }
  }
  return null;
}

export async function buscarRegistrosRecentesParecidos(keyword: string, status: string) {
  try {
    const params: unknown[] = [];
    let filtroStatus = `status IN ('lost', 'found', 'stolen')`;
    if (status && status !== 'all') { params.push(status); filtroStatus = `status = $${params.length}`; }
    const r = await query(
      `SELECT id, title, description, status, category, type, location, latitude, longitude, qr_code, images, created_at, source
         FROM objects
        WHERE is_public = true AND ${filtroStatus}
          AND is_legacy IS NOT TRUE AND COALESCE(source, '') <> 'webjetos'
          AND created_at >= NOW() - INTERVAL '${DIAS_REGISTROS_RECENTES} days'
        ORDER BY created_at DESC
        LIMIT 300`,
      params,
    );
    return (r.rows as Linha[])
      .filter((row) => !tituloRecuperado(row.title) && temPalavraIdentificadoraEmComum(keyword, row.title, row.description))
      .slice(0, MAX_REGISTROS_RECENTES)
      .map((row) => maskSignalForPublicApi({
        source: row.source as string | null,
        id: row.id,
        title: row.title as string,
        description: (row.description as string) || '',
        status: row.status,
        category: (row.category as string) || (row.type as string) || 'other',
        unique_code: row.qr_code,
        photos: fotos(row.images),
        location: local(row),
        created_at: row.created_at,
      }))
      .map(({ source: _source, ...resto }) => resto);
  } catch {
    return []; // a lista de apoio nunca derruba o passo 2: sem ela, fica só o aviso
  }
}
