export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';

// Verifica se a coluna search_vector já existe (cache em memória por processo)
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
    // Suporte a paginação por cursor (cursor = updated_at ISO string do último item)
    const cursor   = searchParams.get('cursor');
    const page     = parseInt(searchParams.get('page') || '1');
    const offset   = cursor ? null : (page - 1) * limit;

    const ftsAvailable = await checkFTS();

    const params: unknown[] = [];
    const conditions: string[] = ['is_public = true'];

    // ── Filtro de status ──────────────────────────────────────────────────
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    } else {
      conditions.push(`status IN ('lost', 'found', 'stolen')`);
    }

    // ── Filtro de categoria ───────────────────────────────────────────────
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    // ── Busca por keyword: FTS se disponível, ILIKE como fallback ─────────
    let rankExpr = '0::float AS rank';
    if (keyword.length > 0) {
      if (ftsAvailable) {
        // Full-text search com ranking por relevância
        params.push(keyword);
        const pIdx = params.length;
        conditions.push(
          `(search_vector @@ plainto_tsquery('portuguese', $${pIdx})` +
          ` OR title ILIKE $${pIdx + 1})`
        );
        params.push(`%${keyword}%`);
        rankExpr = `ts_rank(search_vector, plainto_tsquery('portuguese', $${pIdx})) AS rank`;
      } else {
        // Fallback: ILIKE em múltiplos campos
        params.push(`%${keyword.toLowerCase()}%`);
        const p = params.length;
        conditions.push(
          `(LOWER(title) LIKE $${p} OR LOWER(description) LIKE $${p}` +
          ` OR LOWER(color) LIKE $${p} OR LOWER(brand) LIKE $${p} OR LOWER(breed) LIKE $${p})`
        );
      }
    }

    // ── Paginação por cursor ──────────────────────────────────────────────
    if (cursor) {
      params.push(cursor);
      conditions.push(`updated_at < $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // ── Query principal ───────────────────────────────────────────────────
    const orderBy = keyword.length > 0 && ftsAvailable
      ? `ORDER BY rank DESC, is_boosted DESC, updated_at DESC NULLS LAST`
      : `ORDER BY
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
        ${rankExpr}
      FROM objects
      ${whereClause}
      ${orderBy}
      ${paginationClause}
    `;

    const result = await query(sql, params);

    // ── Contagem total (apenas para paginação por offset) ─────────────────
    let total = 0;
    let pages = 1;
    if (!cursor) {
      const countParams: unknown[] = [];
      const countConds: string[] = ['is_public = true'];
      if (status && status !== 'all') {
        countParams.push(status);
        countConds.push(`status = $${countParams.length}`);
      } else {
        countConds.push(`status IN ('lost', 'found', 'stolen')`);
      }
      if (category) {
        countParams.push(category);
        countConds.push(`category = $${countParams.length}`);
      }
      if (keyword.length > 0) {
        if (ftsAvailable) {
          countParams.push(keyword);
          const pIdx = countParams.length;
          countConds.push(
            `(search_vector @@ plainto_tsquery('portuguese', $${pIdx})` +
            ` OR title ILIKE $${pIdx + 1})`
          );
          countParams.push(`%${keyword}%`);
        } else {
          countParams.push(`%${keyword.toLowerCase()}%`);
          const p = countParams.length;
          countConds.push(
            `(LOWER(title) LIKE $${p} OR LOWER(description) LIKE $${p}` +
            ` OR LOWER(color) LIKE $${p} OR LOWER(brand) LIKE $${p} OR LOWER(breed) LIKE $${p})`
          );
        }
      }
      const countResult = await query(
        `SELECT COUNT(*) as count FROM objects WHERE ${countConds.join(' AND ')}`,
        countParams
      );
      total = parseInt(countResult.rows[0].count);
      pages = Math.ceil(total / limit);
    }

    // ── Normalizar para RegisteredObject ──────────────────────────────────
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
      _rank: row.rank ?? 0,
    }));

    // Cursor para a próxima página (updated_at do último item)
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
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
