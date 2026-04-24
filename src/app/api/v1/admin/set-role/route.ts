import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET ?? '';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret');
  if (!secret || secret !== MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { email, role } = await req.json() as { email: string; role: string };

    if (!email || !role) {
      return NextResponse.json({ detail: 'email e role são obrigatórios' }, { status: 400 });
    }

    const validRoles = ['super_admin', 'admin', 'b2b_admin', 'user'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ detail: `role inválido. Use: ${validRoles.join(', ')}` }, { status: 400 });
    }

    const result = await query(
      `UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, name, role`,
      [role, email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ detail: `Usuário ${email} não encontrado` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    return NextResponse.json({ detail: 'Erro interno', error: String(err) }, { status: 500 });
  }
}
