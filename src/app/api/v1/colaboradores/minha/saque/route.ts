// POST /api/v1/colaboradores/minha/saque (E6). Logado. Pede o saque de TODO o saldo disponível (precisa atingir o mínimo e ter canal verificado e dados de pagamento).
// O valor fica reservado no livro na hora. Só com COLABORADORES_SAQUE=1. Desligada = 404.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { solicitarSaque } from '@/lib/colaboradores/saque';
import { desligada, desligadaSaque, limitar, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

const MENSAGENS = {
  NAO_ENCONTRADO: 'Não há página de colaborador ativa.', NAO_VERIFICADO: 'O saque só é liberado depois que o Backfindr confirmar o seu canal.',
  SEM_DADOS_PAGAMENTO: 'Cadastre os dados de pagamento antes de pedir o saque.', SAQUE_ABERTO: 'Você já tem um pedido de saque em andamento.',
  SALDO_INSUFICIENTE: 'O saldo disponível ainda não atingiu o valor mínimo para saque.',
} as const;

export async function POST(req: NextRequest) {
  const off = desligada() ?? desligadaSaque(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  if (limitar(`saque:${user}`, 10, 60 * 60_000)) return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Tente de novo mais tarde.' }, { status: 429, headers: SEM_CACHE });
  const client = await getClient();
  try {
    const r = await solicitarSaque(client, user);
    if (r.ok) return NextResponse.json({ ok: true, saque: r.saque }, { status: 201, headers: SEM_CACHE });
    return NextResponse.json({ ok: false, erro: MENSAGENS[r.erro], codigo: r.erro, disponivelCentavos: r.disponivelCentavos, minimoCentavos: r.minimoCentavos }, { status: r.erro === 'NAO_ENCONTRADO' ? 404 : 409, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] saque falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  } finally {
    client.release();
  }
}
