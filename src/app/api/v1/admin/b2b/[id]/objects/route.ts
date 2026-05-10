export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const partnerId = params.id;

  // b2b_admin só pode ver dados do seu próprio parceiro
  if (user.role === 'b2b_admin' && user.b2b_partner_id !== partnerId) {
    return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const size = Math.min(parseInt(url.searchParams.get('size') ?? '20'), 50);
  const offset = (page - 1) * size;

  try {
    const result = await query(
      `SELECT
        o.id, o.title, o.status, o.category, o.created_at,
        u.name AS owner_name
       FROM objects o
       JOIN users u ON u.id = o.owner_id
       WHERE u.b2b_partner_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [partnerId, size, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM objects o
       JOIN users u ON u.id = o.owner_id
       WHERE u.b2b_partner_id = $1`,
      [partnerId]
    );

    return NextResponse.json({
      items: result.rows,
      total: parseInt((countRes.rows[0] as { total: string }).total) || 0,
      page,
      size,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
