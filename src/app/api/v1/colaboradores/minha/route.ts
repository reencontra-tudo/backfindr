// GET /api/v1/colaboradores/minha (E5). Logado. Dados da página do próprio colaborador, estado da verificação e o texto «Comissão em apuração» (sem valores até a E4).
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { minhaColaboracao } from '@/lib/colaboradores/inscricao';
import { desligada, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  try {
    const m = await minhaColaboracao(query, user, process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.com');
    return NextResponse.json({ ok: true, colaborador: m }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] minha falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível carregar agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
