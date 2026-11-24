// GET /api/v1/admin/colaboradores/export?mes=YYYY-MM (E7). Admin. Exportação CSV por colaborador (texto de terceiros protegido contra fórmula de planilha).
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { csvDaLista, listaDeColaboradores, mesAtual, mesValido } from '@/lib/colaboradores/admin';
import { ehResposta, guardaAdmin, SEM_CACHE } from '@/lib/colaboradores/rotaAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guardaAdmin(req); if (ehResposta(g)) return g;
  const mes = req.nextUrl.searchParams.get('mes') ?? mesAtual();
  if (!mesValido(mes)) return NextResponse.json({ ok: false, erro: 'Mês inválido (use AAAA-MM).' }, { status: 400, headers: SEM_CACHE });
  try {
    const csv = csvDaLista(mes, await listaDeColaboradores(query, mes));
    return new NextResponse('﻿' + csv, { headers: { ...SEM_CACHE, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="colaboradores-${mes}.csv"` } });
  } catch (e) { console.error('[colaboradores] exportação falhou', e instanceof Error ? e.message : 'erro'); return NextResponse.json({ ok: false, erro: 'Não foi possível exportar agora.' }, { status: 500, headers: SEM_CACHE }); }
}
