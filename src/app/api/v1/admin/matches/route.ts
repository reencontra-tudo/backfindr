export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url       = new URL(req.url);
  const page      = Math.max(1, parseInt(url.searchParams.get('page')      ?? '1',  10));
  const size      = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const status    = url.searchParams.get('status')    ?? '';
  const min_score = parseFloat(url.searchParams.get('min_score') ?? '0');
  const offset    = (page - 1) * size;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (status) { conditions.push(`m.status = $${idx}`); params.push(status); idx++; }
  if (min_score > 0) { conditions.push(`m.score >= $${idx}`); params.push(min_score); idx++; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM matches m ${where}`, params),
      query(
        `SELECT m.id, m.score, m.status, m.created_at, m.updated_at,
                lo.id AS lost_id, lo.title AS lost_title, lo.category AS lost_category,
                fo.id AS found_id, fo.title AS found_title, fo.category AS found_category
         FROM matches m
         LEFT JOIN objects lo ON lo.id = m.lost_object_id
         LEFT JOIN objects fo ON fo.id = m.found_object_id
         ${where}
         ORDER BY m.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, size, offset]
      ),
    ]);

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e) {
    console.error('[admin/matches GET]', e);
    return NextResponse.json({ detail: 'Erro ao buscar matches' }, { status: 500 });
  }
}
