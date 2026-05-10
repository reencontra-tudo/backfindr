export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/adminGuard';

// ── GET: listar colaboradores da equipe ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const authError = await requireSuperAdmin(req);
  if (authError) return authError;

  try {
    const members = await query(`
      SELECT
        u.id, u.name, u.email, u.avatar_url, u.role,
        u.admin_permissions, u.created_at,
        u.is_active,
        (SELECT COUNT(*) FROM objects WHERE user_id = u.id) AS objects_count
      FROM users u
      WHERE u.role IN ('super_admin', 'admin', 'b2b_admin')
      ORDER BY
        CASE u.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'b2b_admin' THEN 3
          ELSE 4
        END,
        u.created_at ASC
    `);

    const invites = await query(`
      SELECT
        ti.id, ti.email, ti.role, ti.permissions,
        ti.expires_at, ti.accepted_at, ti.created_at,
        u.name AS invited_by_name
      FROM team_invites ti
      LEFT JOIN users u ON u.id = ti.invited_by
      WHERE ti.accepted_at IS NULL AND ti.expires_at > NOW()
      ORDER BY ti.created_at DESC
    `).catch(() => ({ rows: [] }));

    return NextResponse.json({
      members: members.rows,
      pending_invites: invites.rows,
    });
  } catch (err) {
    return NextResponse.json({ detail: 'Erro interno', error: String(err) }, { status: 500 });
  }
}

// ── POST: convidar colaborador ou alterar role/permissões de usuário existente ─
export async function POST(req: NextRequest) {
  const authError = await requireSuperAdmin(req);
  if (authError) return authError;

  const me = (req as NextRequest & { adminUser?: { id: string } }).adminUser;

  try {
    const body = await req.json() as {
      action: 'invite' | 'update_role' | 'update_permissions' | 'revoke';
      email?: string;
      user_id?: string;
      role?: string;
      permissions?: Record<string, boolean>;
    };

    const validRoles = ['super_admin', 'admin', 'b2b_admin', 'user'];

    if (body.action === 'invite') {
      if (!body.email || !body.role) {
        return NextResponse.json({ detail: 'email e role são obrigatórios' }, { status: 400 });
      }
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ detail: 'role inválido' }, { status: 400 });
      }

      // Verificar se já é membro
      const existing = await query(`SELECT id, role FROM users WHERE email = $1`, [body.email]);
      if (existing.rows.length > 0) {
        // Usuário já existe — atualizar role diretamente
        const permissions = body.permissions ? JSON.stringify(body.permissions) : null;
        await query(
          `UPDATE users SET role = $1, admin_permissions = $2 WHERE email = $3`,
          [body.role, permissions, body.email]
        );
        return NextResponse.json({ ok: true, action: 'role_updated', email: body.email });
      }

      // Usuário não existe — criar convite
      const token = crypto.randomUUID();
      const permissions = body.permissions ? JSON.stringify(body.permissions) : null;
      await query(
        `INSERT INTO team_invites (email, role, permissions, invited_by, token)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token) DO NOTHING`,
        [body.email, body.role, permissions, me?.id ?? null, token]
      );
      return NextResponse.json({ ok: true, action: 'invite_sent', email: body.email, token });
    }

    if (body.action === 'update_role') {
      if (!body.user_id || !body.role) {
        return NextResponse.json({ detail: 'user_id e role são obrigatórios' }, { status: 400 });
      }
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ detail: 'role inválido' }, { status: 400 });
      }
      await query(`UPDATE users SET role = $1 WHERE id = $2`, [body.role, body.user_id]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'update_permissions') {
      if (!body.user_id) {
        return NextResponse.json({ detail: 'user_id é obrigatório' }, { status: 400 });
      }
      const permissions = body.permissions ? JSON.stringify(body.permissions) : null;
      await query(`UPDATE users SET admin_permissions = $1 WHERE id = $2`, [permissions, body.user_id]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'revoke') {
      if (!body.user_id) {
        return NextResponse.json({ detail: 'user_id é obrigatório' }, { status: 400 });
      }
      await query(
        `UPDATE users SET role = 'user', admin_permissions = NULL WHERE id = $1`,
        [body.user_id]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ detail: 'action inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ detail: 'Erro interno', error: String(err) }, { status: 500 });
  }
}

// ── DELETE: cancelar convite pendente ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const authError = await requireSuperAdmin(req);
  if (authError) return authError;

  try {
    const { invite_id } = await req.json() as { invite_id: string };
    await query(`DELETE FROM team_invites WHERE id = $1`, [invite_id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ detail: 'Erro interno', error: String(err) }, { status: 500 });
  }
}
