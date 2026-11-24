// GET /api/v1/admin/colaboradores/verificacoes?estado=pendente (E5). Admin. Fila de verificação de canais (a tela vem na E7). Desligada = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { listarVerificacoes } from '@/lib/colaboradores/inscricao';
import { desligada, SEM_CACHE } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const estado = req.nextUrl.searchParams.get('estado') ?? 'pendente';
  if (!['pendente', 'aprovada', 'recusada', 'substituida'].includes(estado)) return NextResponse.json({ ok: false, erro: 'Estado inválido.' }, { status: 400, headers: SEM_CACHE });
  return NextResponse.json({ ok: true, verificacoes: await listarVerificacoes(query, estado) }, { headers: SEM_CACHE });
}
