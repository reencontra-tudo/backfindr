// GET /api/v1/admin/colaboradores/saques?estado=solicitado (E7). Admin. Fila de saques; dados de pagamento MASCARADOS (só o final).
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listarSaquesAdmin } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const estado = req.nextUrl.searchParams.get('estado') ?? 'solicitado';
  if (!['solicitado', 'pago', 'recusado', 'cancelado'].includes(estado)) return NextResponse.json({ ok: false, erro: 'Estado inválido.' }, { status: 400, headers: SEM_CACHE });
  try { return NextResponse.json({ ok: true, saques: await listarSaquesAdmin(query, estado) }, { headers: SEM_CACHE }); }
  catch (e) { console.error('[colaboradores] fila de saques falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE }); }
}
