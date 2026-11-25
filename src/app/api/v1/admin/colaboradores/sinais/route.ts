// GET /api/v1/admin/colaboradores/sinais?estado=aberto (E8). Admin. Fila de sinais de antifraude para ANÁLISE MANUAL. Só números e tipos: nenhum e-mail, nome ou identificador de pessoa.
// Desligada (sem COLABORADORES_ANTIFRAUDE=1) = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { antifraudeAtivo, listarSinais } from '@/lib/colaboradores/antifraude';
import { ehResposta, guardaAdmin, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!antifraudeAtivo()) return new NextResponse(null, { status: 404 });
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const estado = req.nextUrl.searchParams.get('estado') ?? 'aberto';
  if (!['aberto', 'descartado', 'confirmado'].includes(estado)) return NextResponse.json({ ok: false, erro: 'Estado inválido.' }, { status: 400, headers: SEM_CACHE });
  try { return NextResponse.json({ ok: true, sinais: await listarSinais(query, estado) }, { headers: SEM_CACHE }); }
  catch (e) { console.error('[colaboradores] sinais falharam', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE }); }
}
