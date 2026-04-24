export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = body.email as string | undefined;

  try {
    let result;
    if (email) {
      // Definir super_admin por email
      result = await query(
        `UPDATE users SET role = 'super_admin' WHERE email = $1 RETURNING id, email, name, role`,
        [email]
      );
    } else {
      // Fallback: definir o usuário mais antigo como super_admin
      result = await query(
        `UPDATE users SET role = 'super_admin'
         WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
         RETURNING id, email, name, role`
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: false, detail: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = result.rows[0];
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
