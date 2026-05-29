import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      'SELECT * FROM entregadores WHERE user_id = $1 LIMIT 1',
      [auth.user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Não é entregador' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
