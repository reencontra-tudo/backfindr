// POST /api/v1/colaboradores/inscricao (E5). Logado. Cria o colaborador (página no ar, SEM verificação), registra o aceite da política e abre a verificação
// do canal, tudo numa transação. Um colaborador por conta. Desligada (COLABORADORES_INSCRICAO ausente) = 404.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { criarInscricao, validarInscricao, TEXTO_COMISSAO_EM_APURACAO } from '@/lib/colaboradores/inscricao';
import { desligada, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const off = desligada(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`insc:${user}`, 5, 60 * 60_000)) return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Tente de novo mais tarde.' }, { status: 429, headers: SEM_CACHE });

  let corpo: unknown;
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE }); }
  const v = validarInscricao(corpo);
  if (!v.ok) return NextResponse.json({ ok: false, erro: 'Confira os campos.', campos: v.erros }, { status: 400, headers: SEM_CACHE });

  const client = await getClient();
  try {
    const r = await criarInscricao(client, user, v.dados);
    if (!r.ok) {
      return r.erro === 'SLUG_INDISPONIVEL'
        ? NextResponse.json({ ok: false, erro: 'Este @nome já está em uso. Escolha outro.', campos: { slug: 'Este @nome já está em uso.' } }, { status: 409, headers: SEM_CACHE })
        : NextResponse.json({ ok: false, erro: 'Esta conta já tem uma página de colaborador.' }, { status: 409, headers: SEM_CACHE });
    }
    return NextResponse.json({ ok: true, colaborador: r.colaborador, verificacao: r.verificacao, comissao: TEXTO_COMISSAO_EM_APURACAO }, { status: 201, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] inscrição falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora. Tente de novo.' }, { status: 500, headers: SEM_CACHE });
  } finally {
    client.release();
  }
}
