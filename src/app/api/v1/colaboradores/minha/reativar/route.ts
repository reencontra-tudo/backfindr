// POST /api/v1/colaboradores/minha/reativar (E5). Logado. O PRÓPRIO colaborador que saiu por vontade própria reativa o seu @nome (PC-13). Suspenso e excluído: não.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { reativarPagina } from '@/lib/colaboradores/inscricao';
import { desligada, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  try {
    const ok = await reativarPagina(query, user);
    return ok ? NextResponse.json({ ok: true }, { headers: SEM_CACHE }) : NextResponse.json({ ok: false, erro: 'Esta página não pode ser reativada por aqui.' }, { status: 409, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] reativar falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
