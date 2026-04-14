import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';
import { z } from 'zod';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const PartnerSchema = z.object({
  name:    z.string().min(2).max(200),
  type:    z.enum(['condominio', 'shopping', 'hotel', 'transporte', 'saude', 'educacao', 'outro']),
  city:    z.string().min(2).max(200),
  contact: z.string().min(2).max(200),
  email:   z.string().email(),
  phone:   z.string().optional(),
  notes:   z.string().optional(),
});

// ─── GET /api/v1/admin/b2b ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url    = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const search = url.searchParams.get('search') ?? '';

  try {
    // Buscar do backend — endpoint b2b a ser criado
    const res = await fetch(
      `${API}/api/v1/admin/b2b?status=${status}&search=${search}`,
      { headers: backendHeaders(req) }
    );

    if (res.ok) {
      return NextResponse.json(await res.json());
    }

    // Fallback — dados estáticos enquanto endpoint não existe
    return NextResponse.json({
      items: [],
      total: 0,
      message: 'Endpoint b2b backend pendente de implementação',
    });
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 200 });
  }
}

// ─── POST /api/v1/admin/b2b ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ detail: 'JSON inválido' }, { status: 400 }); }

  const result = PartnerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { detail: 'Dados inválidos', errors: result.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const res = await fetch(`${API}/api/v1/admin/b2b`, {
      method: 'POST',
      headers: backendHeaders(req),
      body: JSON.stringify(result.data),
    });

    if (res.ok) return NextResponse.json(await res.json(), { status: 201 });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ detail: 'Erro ao criar parceiro' }, { status: 500 });
  }
}
