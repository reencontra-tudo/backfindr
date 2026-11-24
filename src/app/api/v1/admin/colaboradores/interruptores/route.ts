// Admin: estado dos dois interruptores do Programa de Colaboradores (somente leitura, sem banco). O painel mostra um aviso quando estão diferentes.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { lerInterruptores } from '@/lib/colaboradores/interruptores';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(lerInterruptores(), { headers: { 'Cache-Control': 'no-store' } });
}
