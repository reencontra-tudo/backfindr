import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

// ─── Hierarquia de roles ──────────────────────────────────────────────────────
// super_admin : dono da plataforma — acesso total a tudo
// b2b_admin   : gestor de parceiro B2B — acesso restrito ao próprio parceiro
// user        : usuário comum (free / pro / business) — sem acesso admin
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'b2b_admin' | 'user';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: UserRole;
  b2b_partner_id?: string | null;
}

async function resolveUser(req: NextRequest): Promise<AdminUser | NextResponse> {
  const cookieToken = req.cookies.get('access_token')?.value;
  const headerToken = extractTokenFromHeader(req.headers.get('authorization'));
  const token = cookieToken ?? headerToken;

  if (!token) {
    return NextResponse.json({ detail: 'Não autenticado' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, email, name, plan, role, b2b_partner_id FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 401 });
    }
    const u = result.rows[0] as {
      id: string; email: string; name: string;
      plan: string; role: string | null; b2b_partner_id: string | null;
    };
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan ?? 'free',
      role: (u.role as UserRole) ?? 'user',
      b2b_partner_id: u.b2b_partner_id,
    };
  } catch {
    return NextResponse.json({ detail: 'Erro de autenticação' }, { status: 500 });
  }
}

/** Requer super_admin — dono da plataforma, acesso total */
export async function requireSuperAdmin(
  req: NextRequest
): Promise<{ user: AdminUser } | NextResponse> {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  if (result.role !== 'super_admin') {
    return NextResponse.json({ detail: 'Acesso restrito ao super admin' }, { status: 403 });
  }
  return { user: result };
}

/** Requer super_admin OU b2b_admin — b2b_admin vê apenas dados do seu parceiro */
export async function requireAdmin(
  req: NextRequest
): Promise<{ user: AdminUser } | NextResponse> {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  if (result.role !== 'super_admin' && result.role !== 'b2b_admin') {
    return NextResponse.json({ detail: 'Acesso restrito' }, { status: 403 });
  }
  return { user: result };
}

/** Requer qualquer usuário autenticado */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: AdminUser } | NextResponse> {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  return { user: result };
}

export function backendHeaders(req: NextRequest): HeadersInit {
  const token = req.cookies.get('access_token')?.value ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function forwardParams(req: NextRequest, allowed: string[]): string {
  const url = new URL(req.url);
  const params = new URLSearchParams();
  allowed.forEach(key => {
    const val = url.searchParams.get(key);
    if (val) params.set(key, val);
  });
  const str = params.toString();
  return str ? `?${str}` : '';
}
