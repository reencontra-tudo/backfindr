export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url      = new URL(req.url);
  const page     = Math.max(1, parseInt(url.searchParams.get('page')     ?? '1',  10));
  const size     = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const search   = url.searchParams.get('search')   ?? '';
  const status   = url.searchParams.get('status')   ?? '';
  const user     = url.searchParams.get('user')     ?? '';
  const category = url.searchParams.get('category') ?? '';
  const offset   = (page - 1) * size;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (search)   { conditions.push(`(o.title ILIKE $${idx} OR o.description ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  if (status)   { conditions.push(`o.status = $${idx}`); params.push(status); idx++; }
  if (user)     { conditions.push(`o.user_id = $${idx}`); params.push(user); idx++; }
  if (category) { conditions.push(`o.category = $${idx}`); params.push(category); idx++; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes, countsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM objects o ${where}`, params),
      query(
        `SELECT o.id, o.title, o.description, o.status, o.category, o.qr_code,
                o.location, o.is_legacy, o.source, o.created_at, o.updated_at,
                o.user_id AS owner_id,
                u.name AS owner_name, u.email AS owner_email
         FROM objects o
         LEFT JOIN users u ON u.id = o.user_id
         ${where}
         ORDER BY o.updated_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, size, offset]
      ),
      // Contagens por status (sem filtro de status para mostrar totais reais)
      query(
        `SELECT status, COUNT(*) AS cnt FROM objects o
         ${conditions.filter((_, i) => params[i] !== status).length > 0
           ? `WHERE ${conditions.filter((_, i) => params[i] !== status).join(' AND ')}`
           : ''}
         GROUP BY status`,
        params.filter(p => p !== status)
      ),
    ]);

    const counts: Record<string, number> = {};
    for (const row of countsRes.rows) {
      counts[row.status] = parseInt(row.cnt, 10);
    }

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      counts,
      page,
      size,
    });
  } catch (e) {
    console.error('[admin/objects GET]', e);
    return NextResponse.json({ detail: 'Erro ao buscar objetos' }, { status: 500 });
  }
}
