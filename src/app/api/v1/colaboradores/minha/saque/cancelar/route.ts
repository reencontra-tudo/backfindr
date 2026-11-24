// POST /api/v1/colaboradores/minha/saque/cancelar (E6). Logado. Cancela o pedido ainda aberto; o valor volta ao saldo. Só com COLABORADORES_SAQUE=1. Desligada = 404.
import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { cancelarSaque } from '@/lib/colaboradores/saque';
import { desligada, desligadaSaque, naoAutenticado, SEM_CACHE, usuarioLogado } from '@/lib/colaboradores/rotaInscricao';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const off = desligada() ?? desligadaSaque(); if (off) return off;
  const user = usuarioLogado(req); if (!user) return naoAutenticado();
  const client = await getClient();
  try {
    const r = await cancelarSaque(client, user);
    return r.ok ? NextResponse.json({ ok: true, valorCentavos: r.valorCentavos }, { headers: SEM_CACHE })
      : NextResponse.json({ ok: false, erro: 'Não há pedido de saque em aberto.', codigo: r.erro }, { status: 409, headers: SEM_CACHE });
  } catch (e) {
    console.error('[colaboradores] cancelar saque falhou', e instanceof Error ? e.message : 'erro');
    return NextResponse.json({ ok: false, erro: 'Não foi possível concluir agora.' }, { status: 500, headers: SEM_CACHE });
  } finally {
    client.release();
  }
}
