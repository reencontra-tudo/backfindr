// PUT /api/v1/colaboradores/minha/dados-pagamento (E6). Logado. Grava a chave PIX e o documento do titular CIFRADOS (AES-256-GCM). Só com COLABORADORES_SAQUE=1.
// Sem PIX_CHAVE_CIFRAGEM o servidor RECUSA gravar (503): nunca grava em claro. A resposta NUNCA devolve a chave nem o documento (só o final). Desligada = 404.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { CifragemIndisponivel, validarDadosPagamento } from '@/lib/colaboradores/pagamento';
import { lerDadosPagamento, salvarDadosPagamento } from '@/lib/colaboradores/saque';
import { desligada, desligadaSaque, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const off = desligada() ?? desligadaSaque(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`pix:${user}`, 10, 60 * 60_000)) return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Tente de novo mais tarde.' }, { status: 429, headers: SEM_CACHE });
  let corpo: unknown; try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: 'Corpo inválido.' }, { status: 400, headers: SEM_CACHE }); }
  const v = validarDadosPagamento(corpo);
  if (!v.ok) return NextResponse.json({ ok: false, erro: 'Confira os campos.', campos: v.erros }, { status: 400, headers: SEM_CACHE });
  try {
    const c = await query(`SELECT id FROM colaboradores WHERE user_id = $1 AND interno = FALSE AND estado IN ('ativo','saiu') LIMIT 1`, [user]);
    if (c.rows.length === 0) return NextResponse.json({ ok: false, erro: 'Não há página de colaborador.' }, { status: 409, headers: SEM_CACHE });
    const id = String(c.rows[0].id);
    await salvarDadosPagamento(query, id, v.dados);
    return NextResponse.json({ ok: true, dadosPagamento: await lerDadosPagamento(query, id) }, { headers: SEM_CACHE });
  } catch (e) {
    if (e instanceof CifragemIndisponivel) { console.error('[colaboradores] cifragem indisponível: dados de pagamento NÃO gravados'); return NextResponse.json({ ok: false, erro: 'Cadastro de dados de pagamento indisponível no momento.' }, { status: 503, headers: SEM_CACHE }); }
    console.error('[colaboradores] dados de pagamento falharam', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  }
}
