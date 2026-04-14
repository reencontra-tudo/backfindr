import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const VALID_STATUSES = ['lost', 'found', 'returned', 'stolen', 'archived'];

// ─── PATCH /api/v1/admin/objects/[id] ────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { detail: `Status inválido. Permitidos: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${API}/api/v1/admin/objects/${params.id}`, {
      method: 'PATCH',
      headers: backendHeaders(req),
      body: JSON.stringify({ status: body.status }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao atualizar objeto' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/admin/objects/[id] ───────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await fetch(`${API}/api/v1/admin/objects/${params.id}`, {
      method: 'DELETE',
      headers: backendHeaders(req),
    });

    if (res.status === 204 || res.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao remover objeto' }, { status: 500 });
  }
}

// ─── GET /api/v1/admin/objects/[id] — detalhes completos ─────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await fetch(`${API}/api/v1/objects/${params.id}`, {
      headers: backendHeaders(req),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao buscar objeto' }, { status: 500 });
  }
}
