// POST /api/v1/colaboradores/minha/sair (E5). Logado. Saída voluntária: a página passa a redirecionar ao Feed (307); nada é apagado (POLÍTICA §8).
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sairDoPrograma } from '@/lib/colaboradores/inscricao';
import { desligada, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  try {
    const ok = await sairDoPrograma(query, user);
    return ok ? NextResponse.json({ ok: true }, { headers: SEM_CACHE }) : NextResponse.json({ ok: false, erro: 'Não há página ativa para encerrar.' }, { status: 409, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] sair falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
