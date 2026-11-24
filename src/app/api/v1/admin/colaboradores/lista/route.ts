// GET /api/v1/admin/colaboradores/lista?mes=YYYY-MM (E7). Admin. Lista de colaboradores com métricas do mês (ocorrências com o código, compras de Boost, comissão) e saldo total do livro.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { listaDeColaboradores, mesAtual, mesValido } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const mes = req.nextUrl.searchParams.get('mes') ?? mesAtual();
  if (!mesValido(mes)) return NextResponse.json({ ok: false, erro: 'Mês inválido (use AAAA-MM).' }, { status: 400, headers: SEM_CACHE });
  try { return NextResponse.json({ ok: true, mes, colaboradores: await listaDeColaboradores(query, mes) }, { headers: SEM_CACHE }); }
  catch (e) { console.error('[colaboradores] lista falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE }); }
}
