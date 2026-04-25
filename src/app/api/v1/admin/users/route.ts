export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
// super_admin / admin → todos os usuários
// admin (b2b_admin via requireAdmin não chega aqui, mas admin interno com
//   b2b_partner_id definido → filtrado pela empresa)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: adminUser } = auth;

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

    // ── Filtro B2B: admin vinculado a uma empresa só vê os usuários dela ──────
    if (adminUser.role === 'admin' && adminUser.b2b_partner_id) {
      conditions.push(`u.b2b_partner_id = $${idx}`);
      params.push(adminUser.b2b_partner_id);
      idx++;
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (filter === 'pro') {
      conditions.push(`u.plan = 'pro'`);
    } else if (filter === 'business') {
      conditions.push(`u.plan = 'business'`);
    } else if (filter === 'free') {
      conditions.push(`(u.plan = 'free' OR u.plan IS NULL)`);
    } else if (filter === 'verified') {
      conditions.push(`u.is_verified = true`);
    } else if (filter === 'legacy') {
      conditions.push(`EXISTS (SELECT 1 FROM objects o WHERE o.user_id = u.id AND o.is_legacy = true)`);
    } else if (filter === 'inactive') {
      conditions.push(`u.updated_at < NOW() - INTERVAL '90 days'`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, rowsRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM users u ${where}`, params),
      query(
        `SELECT u.id, u.email, u.name, u.phone, u.plan, u.is_verified, u.avatar_url, u.created_at, u.updated_at
         FROM users u ${where}
         ORDER BY u.created_at DESC
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
