export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  notificarEntregaConfirmada,
  notificarEntregadorComprovanteGerado,
} from '@/lib/notifyModulos';

// POST /api/v1/delivery/confirmar/[token]
// Cliente confirma o recebimento via link único — sem autenticação necessária
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: number; lng?: number };

  try {
    const res = await query(
      `SELECT e.*,
              est.nome AS estabelecimento_nome
       FROM entregas e
       LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
       WHERE e.link_token = $1`,
      [params.token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Link inválido ou expirado' }, { status: 404 });
    }

    const entrega = res.rows[0] as {
      id: string; status: string;
      cliente_user_id: string | null;
      cliente_nome: string;
      entregador_user_id: string | null;
      estabelecimento_nome: string;
      descricao: string | null;
    };

    if (entrega.status === 'entregue') {
      return NextResponse.json({ detail: 'Entrega já confirmada' }, { status: 409 });
    }
    if (entrega.status === 'cancelado') {
      return NextResponse.json({ detail: 'Entrega cancelada' }, { status: 409 });
    }

    // Confirmar entrega
    await query(
      `UPDATE entregas
       SET status      = 'entregue',
           entregue_em = NOW(),
           updated_at  = NOW()
       WHERE id = $1`,
      [entrega.id]
    );

    // Registrar evento final com localização — prova operacional
    await query(
      `INSERT INTO entrega_eventos (entrega_id, tipo, lat, lng, observacao)
       VALUES ($1, 'entregue', $2, $3, $4)`,
      [
        entrega.id,
        lat ?? null, lng ?? null,
        `Confirmado por ${entrega.cliente_nome}`,
      ]
    );

    const est  = entrega.estabelecimento_nome;
    const desc = entrega.descricao ?? 'pedido';

    // Notificar cliente e entregador (fire-and-forget)
    if (entrega.cliente_user_id) {
      notificarEntregaConfirmada(entrega.cliente_user_id, est).catch(() => {});
    }
    if (entrega.entregador_user_id) {
      notificarEntregadorComprovanteGerado(
        entrega.entregador_user_id,
        desc,
        entrega.cliente_nome
      ).catch(() => {});
    }

    return NextResponse.json({
      message:     'Entrega confirmada com sucesso',
      entregue_em: new Date(),
      estabelecimento_nome: est,
      descricao:   desc,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
