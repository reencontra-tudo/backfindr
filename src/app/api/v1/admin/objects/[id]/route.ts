export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

const VALID_STATUSES = ['lost', 'found', 'returned', 'stolen', 'archived'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const res = await query(
      `SELECT o.id, o.title, o.description, o.status, o.category, o.type, o.qr_code,
              o.location, o.latitude, o.longitude, o.images, o.color, o.brand, o.breed,
              o.is_legacy, o.source, o.reward_amount, o.reward_description,
              o.created_at, o.updated_at,
              u.name AS owner_name, u.email AS owner_email
       FROM objects o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [params.id]
    );
    if (res.rows.length === 0) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e) { return NextResponse.json({ detail: 'Erro ao buscar objeto' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ detail: `Status inválido. Permitidos: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  try {
    const res = await query(
      `UPDATE objects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, status, updated_at`,
      [body.status, params.id]
    );
    if (res.rows.length === 0) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e) { return NextResponse.json({ detail: 'Erro ao atualizar objeto' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await query(`DELETE FROM objects WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao remover objeto' }, { status: 500 }); }
}
