// GET /api/v1/colaboradores/minha/painel (E6). Logado. Ocorrências cadastradas pelo seu link (campos públicos fixos), saldo (só com COLABORADORES_SALDO=1; senão null) e,
// com COLABORADORES_SAQUE=1, dados de pagamento MASCARADOS e pedidos de saque. Desligada (sem a inscrição) = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { painelDoColaborador } from '@/lib/colaboradores/painel';
import { desligada, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  try {
    const c = await query('SELECT id FROM colaboradores WHERE user_id = $1 LIMIT 1', [user]);
    if (c.rows.length === 0) return NextResponse.json({ ok: true, painel: null }, { headers: SEM_CACHE });
    return NextResponse.json({ ok: true, painel: await painelDoColaborador(query, String(c.rows[0].id)) }, { headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] painel falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível carregar agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
