export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
  const size   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const search = url.searchParams.get('search') ?? '';
  const filter = url.searchParams.get('filter') ?? '';
  const offset = (page - 1) * size;

  try {
    const conditions: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (filter === 'pro') {
      conditions.push(`plan = 'pro'`);
    } else if (filter === 'free') {
      conditions.push(`(plan = 'free' OR plan IS NULL)`);
    } else if (filter === 'verified') {
      conditions.push(`is_verified = true`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM users ${where}`, params),
      query(
        `SELECT id, email, name, phone, plan, is_verified, avatar_url, created_at, updated_at
         FROM users ${where}
         ORDER BY created_at DESC
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
    console.error('[admin/users GET]', e);
    return NextResponse.json({ detail: 'Erro ao buscar usuários' }, { status: 500 });
  }
}
