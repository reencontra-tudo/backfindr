import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── PATCH /api/v1/admin/users/[id] ──────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

  // Validação dos campos permitidos
  const allowed = ['is_active', 'plan'];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ detail: 'Nenhum campo válido para atualizar' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API}/api/v1/admin/users/${params.id}`, {
      method: 'PATCH',
      headers: backendHeaders(req),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao atualizar usuário' }, { status: 500 });
  }
}

// ─── GET /api/v1/admin/users/[id] — perfil completo ──────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Buscar usuário + objetos dele em paralelo
    const [userRes, objectsRes] = await Promise.all([
      fetch(`${API}/api/v1/users/${params.id}/public`, { headers: backendHeaders(req) }),
      fetch(`${API}/api/v1/admin/objects?user=${params.id}&size=50`, { headers: backendHeaders(req) }),
    ]);

    const user    = userRes.ok    ? await userRes.json()    : null;
    const objects = objectsRes.ok ? await objectsRes.json() : { items: [], total: 0 };

    if (!user) return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });

    return NextResponse.json({ ...user, objects });
  } catch {
    return NextResponse.json({ detail: 'Erro ao buscar perfil' }, { status: 500 });
  }
}
