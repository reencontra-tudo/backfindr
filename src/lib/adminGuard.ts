import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
}

/**
 * Verifica se o request vem de um admin autenticado.
 * Retorna o usuário ou lança NextResponse de erro.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ user: AdminUser } | NextResponse> {
  const token = req.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.json({ detail: 'Não autenticado' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
    }

    const user: AdminUser = await res.json();

    // Verificação por ID explícito OU plano business
    const isAdmin =
      ADMIN_IDS.includes(user.id) ||
      user.plan === 'business' ||
      (process.env.NODE_ENV === 'development'); // facilita dev local

    if (!isAdmin) {
      return NextResponse.json({ detail: 'Acesso restrito' }, { status: 403 });
    }

    return { user };
  } catch {
    return NextResponse.json({ detail: 'Erro de autenticação' }, { status: 500 });
  }
}

/** Helper — passa o token do cookie para o backend FastAPI */
export function backendHeaders(req: NextRequest): HeadersInit {
  const token = req.cookies.get('access_token')?.value ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Helper — forward de query params */
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
