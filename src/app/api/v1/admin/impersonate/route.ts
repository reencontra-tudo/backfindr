export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'backfindr-super-secret-key-2026-production-xyz';

/**
 * POST /api/v1/admin/impersonate
 * Body: { user_id: string }
 *
 * Somente super_admin pode chamar este endpoint.
 * Retorna um token temporário (2h) com o campo `impersonated_by` no payload,
 * identificando quem iniciou a impersonation.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: superAdmin } = auth;

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Body inválido' }, { status: 400 });
  }

  const { user_id } = body;
  if (!user_id) {
    return NextResponse.json({ detail: 'user_id é obrigatório' }, { status: 400 });
  }

  // Não permitir impersonar a si mesmo
  if (user_id === superAdmin.id) {
    return NextResponse.json({ detail: 'Não é possível impersonar a si mesmo' }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT id, email, name, plan, role FROM users WHERE id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    }

    const targetUser = result.rows[0] as {
      id: string; email: string; name: string; plan: string; role: string;
    };

    // Não permitir impersonar outro super_admin
    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ detail: 'Não é possível impersonar outro super admin' }, { status: 403 });
    }

    // Gerar token de impersonation com validade de 2 horas
    const impersonationToken = jwt.sign(
      {
        sub: targetUser.id,
        email: targetUser.email,
        impersonated_by: superAdmin.id,
        impersonated_by_email: superAdmin.email,
      },
      SECRET_KEY,
      { algorithm: 'HS256', expiresIn: '2h' }
    );

    return NextResponse.json({
      access_token: impersonationToken,
      token_type: 'Bearer',
      target_user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        plan: targetUser.plan,
      },
    });
  } catch (e) {
    console.error('[admin/impersonate]', e);
    return NextResponse.json({ detail: 'Erro ao gerar token de impersonation' }, { status: 500 });
  }
}
