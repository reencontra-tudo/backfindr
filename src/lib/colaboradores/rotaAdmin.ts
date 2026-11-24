// Guarda comum das rotas do ADMIN do programa (E7): interruptor (COLABORADORES_ATIVO) + papel de admin. Desligado = 404 vazio.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { adminAtivo } from './admin';

export const SEM_CACHE = { 'Cache-Control': 'no-store' };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devolve a resposta de recusa (404/401/403) ou o id do admin. */
export async function guardaAdmin(req: NextRequest): Promise<NextResponse | { adminId: string }> {
  if (!adminAtivo()) return new NextResponse(null, { status: 404 });
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return { adminId: auth.user.id };
}
export const ehResposta = (x: unknown): x is NextResponse => x instanceof NextResponse;
export const lerCorpo = async (req: NextRequest): Promise<Record<string, unknown> | null> => { try { const j = await req.json(); return j && typeof j === 'object' ? (j as Record<string, unknown>) : null; } catch { return null; } };
