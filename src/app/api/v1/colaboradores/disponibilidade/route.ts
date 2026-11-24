// GET /api/v1/colaboradores/disponibilidade?slug=<@nome> (E5). Logado. Diz se o @nome pode ser pedido (formato, reservado, em uso). Desligada = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { disponibilidadeDoSlug } from '@/lib/colaboradores/inscricao';
import { desligada, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`disp:${user}`, 60, 60_000)) return NextResponse.json({ ok: false, erro: 'Muitas consultas. Aguarde um instante.' }, { status: 429, headers: SEM_CACHE });
  try {
    return NextResponse.json({ ok: true, ...(await disponibilidadeDoSlug(query, req.nextUrl.searchParams.get('slug'))) }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] disponibilidade falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível consultar agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
