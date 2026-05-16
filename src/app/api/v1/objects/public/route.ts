export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';

// ─── Dicionário de sinônimos (PT-BR, normalizado sem acento) ───────────────
const SINONIMOS: Record<string, string[]> = {
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

function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

// Expande keyword com sinônimos — retorna lista única de termos para ILIKE
function expandirKeyword(keyword: string): string[] {
  const termos = new Set<string>();
  termos.add(keyword.toLowerCase().trim());

  const palavras = removerAcentos(keyword).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  for (const palavra of palavras) {
    const norm = normalizarPalavra(palavra);
    termos.add(norm);
    const sinonimos = SINONIMOS[norm] || [];
    for (const s of sinonimos) termos.add(s);
  }

  return [...termos];
}

// Helper: monta bloco de condições ILIKE com sinônimos expandidos
function buildKeywordConditions(termosExpandidos: string[], params: unknown[]): string {
  const conds: string[] = [];
  for (const termo of termosExpandidos) {
    params.push(`%${termo}%`);
    const p = params.length;
    conds.push(
      `(LOWER(title) LIKE $${p} OR LOWER(description) LIKE $${p}` +
      ` OR LOWER(color) LIKE $${p} OR LOWER(brand) LIKE $${p} OR LOWER(breed) LIKE $${p})`
    );
  }
  return `(${conds.join(' OR ')})`;
}

// Verifica se FTS (search_vector) existe no banco
let hasFTS: boolean | null = null;
async function checkFTS(): Promise<boolean> {
  if (hasFTS !== null) return hasFTS;
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'objects' AND column_name = 'search_vector' LIMIT 1`
    );
    hasFTS = r.rows.length > 0;
  } catch {
    hasFTS = false;
  }
  return hasFTS;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status') || '';
    const category = searchParams.get('category');
    const keyword  = (searchParams.get('keyword') || searchParams.get('q') || '').trim();
    const limit    = Math.min(parseInt(searchParams.get('size') || searchParams.get('limit') || '200'), 500);
    const cursor   = searchParams.get('cursor');
    const page     = parseInt(searchParams.get('page') || '1');
    const offset   = cursor ? null : (page - 1) * limit;

    const ftsAvailable = await checkFTS();

    // ── Monta query principal ─────────────────────────────────────────────
    const params: unknown[] = [];
    const conditions: string[] = ['is_public = true'];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
      if (status === 'found') {
        conditions.push(`(is_legacy = false OR is_legacy IS NULL)`);
      }
    } else {
      conditions.push(`status IN ('lost', 'found', 'stolen')`);
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    // Keyword com expansão de sinônimos
    const termosExpandidos = keyword.length > 0 ? expandirKeyword(keyword) : [];
    if (termosExpandidos.length > 0) {
      conditions.push(buildKeywordConditions(termosExpandidos, params));
    }

    if (cursor) {
      params.push(cursor);
      conditions.push(`updated_at < $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const orderBy = `ORDER BY
      CASE WHEN is_boosted = true AND (boost_expires_at IS NULL OR boost_expires_at > NOW()) THEN 0 ELSE 1 END ASC,
      CASE WHEN images IS NOT NULL AND images != '[]' AND images != 'null' THEN 0 ELSE 1 END ASC,
      CASE WHEN updated_at > NOW() - INTERVAL '2 years' THEN 0 ELSE 1 END ASC,
      updated_at DESC NULLS LAST`;

    params.push(limit);
    const limitParam = params.length;

    let paginationClause: string;
    if (cursor) {
      paginationClause = `LIMIT $${limitParam}`;
    } else {
      params.push(offset as number);
      paginationClause = `LIMIT $${limitParam} OFFSET $${params.length}`;
    }

    const sql = `
      SELECT
        id, title, description, status, category, type,
        location, latitude, longitude, qr_code,
        color, brand, breed, images,
        is_legacy, source, reward_amount, reward_description,
        is_boosted, boost_expires_at, created_at, updated_at,
        0::float AS rank
      FROM objects
      ${whereClause}
      ${orderBy}
      ${paginationClause}
    `;

    const result = await query(sql, params);

    // ── Contagem total ────────────────────────────────────────────────────
    let total = 0;
    let pages = 1;
    if (!cursor) {
      const countParams: unknown[] = [];
      const countConds: string[] = ['is_public = true'];

      if (status && status !== 'all') {
        countParams.push(status);
        countConds.push(`status = $${countParams.length}`);
        if (status === 'found') countConds.push(`(is_legacy = false OR is_legacy IS NULL)`);
      } else {
        countConds.push(`status IN ('lost', 'found', 'stolen')`);
      }

      if (category) {
        countParams.push(category);
        countConds.push(`category = $${countParams.length}`);
      }

      if (termosExpandidos.length > 0) {
        countConds.push(buildKeywordConditions(termosExpandidos, countParams));
      }

      const countResult = await query(
        `SELECT COUNT(*) as count FROM objects WHERE ${countConds.join(' AND ')}`,
        countParams
      );
      total = parseInt(countResult.rows[0].count);
      pages = Math.ceil(total / limit);
    }

    // ── Normalizar resultado ──────────────────────────────────────────────
    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      status: row.status,
      category: row.category || row.type || 'other',
      unique_code: row.qr_code,
      owner_id: null,
      photos: (() => {
        try {
          if (Array.isArray(row.images)) return row.images;
          if (typeof row.images === 'string') return JSON.parse(row.images as string);
          return [];
        } catch { return []; }
      })(),
      location: (() => {
        const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
        const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, address: (row.location as string) || undefined };
        }
        if (row.location && typeof row.location === 'string') {
          try {
            const parsed = JSON.parse(row.location as string);
            if (parsed.lat && parsed.lng) return parsed;
          } catch { /* não é JSON */ }
        }
        return null;
      })(),
      color: row.color,
      brand: row.brand,
      pet_breed: row.breed,
      is_legacy: row.is_legacy,
      source: row.source,
      is_boosted: row.is_boosted ?? false,
      reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
      reward_description: row.reward_description || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      _rank: 0,
    }));

    const nextCursor = items.length === limit
      ? String(items[items.length - 1].updated_at)
      : null;

    return successResponse({
      items,
      total: cursor ? undefined : total,
      page: cursor ? undefined : page,
      size: limit,
      pages: cursor ? undefined : pages,
      next_cursor: nextCursor,
      fts_active: ftsAvailable,
      keywords_expanded: termosExpandidos,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
