import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders, forwardParams } from '@/lib/adminGuard';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const qs = forwardParams(req, ['page', 'size', 'search', 'filter']);

  try {
    const res = await fetch(`${API}/api/v1/admin/users${qs}`, {
      headers: backendHeaders(req),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao buscar usuários' }, { status: 500 });
  }
}
