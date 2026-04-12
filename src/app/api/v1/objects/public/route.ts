import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'lost';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let sql = 'SELECT id, title, description, status, type, location, latitude, longitude, qr_code, created_at FROM objects WHERE status = $1';
    const params: any[] = [status];

    if (type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Contar total
    let countSql = 'SELECT COUNT(*) as count FROM objects WHERE status = $1';
    const countParams: any[] = [status];
    if (type) {
      countSql += ` AND type = $${countParams.length + 1}`;
      countParams.push(type);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    return successResponse({
      objects: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
