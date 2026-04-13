export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || ''; // vazio = todos os status
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('size') || searchParams.get('limit') || '200'), 500);
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    const conditions: string[] = ['is_public = true'];

    // Filtrar por status apenas se especificado
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    } else {
      // Excluir apenas "returned" do mapa público por padrão
      conditions.push(`status IN ('lost', 'found', 'stolen')`);
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        id,
        title,
        description,
        status,
        category,
        type,
        location,
        latitude,
        longitude,
        qr_code,
        color,
        brand,
        breed,
        images,
        is_legacy,
        source,
        created_at,
        updated_at
      FROM objects
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Contar total
    const countParams: unknown[] = [];
    const countConditions: string[] = ['is_public = true'];
    if (status && status !== 'all') {
      countParams.push(status);
      countConditions.push(`status = $${countParams.length}`);
    } else {
      countConditions.push(`status IN ('lost', 'found', 'stolen')`);
    }
    if (category) {
      countParams.push(category);
      countConditions.push(`category = $${countParams.length}`);
    }
    const countWhere = countConditions.length > 0 ? `WHERE ${countConditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) as count FROM objects ${countWhere}`, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Normalizar dados para o formato esperado pelo frontend (RegisteredObject)
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
          if (typeof row.images === 'string') return JSON.parse(row.images);
          return [];
        } catch { return []; }
      })(),
      // Normalizar localização: suporta tanto latitude/longitude separados quanto objeto location
      location: (() => {
        const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
        const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, address: row.location as string || undefined };
        }
        // Tentar parsear location como JSON {lat, lng}
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
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return successResponse({
      items,
      total,
      page,
      size: limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
