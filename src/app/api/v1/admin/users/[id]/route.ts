export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const [userRes, objectsRes] = await Promise.all([
      query(`SELECT id, email, name, phone, plan, is_verified, avatar_url, created_at, updated_at FROM users WHERE id = $1`, [params.id]),
      query(`SELECT id, title, status, category, qr_code, created_at, updated_at FROM objects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [params.id]),
    ]);
    if (userRes.rows.length === 0) return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json({ ...userRes.rows[0], objects: { items: objectsRes.rows, total: objectsRes.rows.length } });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao buscar perfil' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const allowed: Record<string, string> = { is_active: 'boolean', plan: 'string' };
  const sets: string[] = []; const values: unknown[] = []; let idx = 1;
  for (const [key, type] of Object.entries(allowed)) {
    if (key in body) {
      if (type === 'boolean' && typeof body[key] !== 'boolean') continue;
      if (type === 'string' && typeof body[key] !== 'string') continue;
      sets.push(`${key} = $${idx}`); values.push(body[key]); idx++;
    }
  }
  if (sets.length === 0) return NextResponse.json({ detail: 'Nenhum campo válido' }, { status: 400 });
  values.push(params.id);
  try {
    const result = await query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, name, plan, is_verified, updated_at`, values);
    if (result.rows.length === 0) return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (e) { return NextResponse.json({ detail: 'Erro ao atualizar usuário' }, { status: 500 }); }
}
