export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { notificarCustodiaEntregue } from '@/lib/notifyModulos';

// POST /api/v1/custody/confirmar/[token]
// Destinatário confirma a retirada via link único
// Não exige autenticação — o token é a prova de identidade
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: number; lng?: number };

  try {
    // Buscar custódia pelo token
    const res = await query(
      `SELECT c.*, usr.name AS remetente_nome
       FROM custodias c
       LEFT JOIN users usr ON usr.id = c.remetente_id
       WHERE c.link_token = $1`,
      [params.token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Link inválido ou expirado' }, { status: 404 });
    }

    const cust = res.rows[0] as {
      id: string; status: string;
      remetente_id: string; remetente_nome: string;
      descricao: string; destinatario_nome: string;
    };

    if (cust.status === 'entregue') {
      return NextResponse.json({ detail: 'Item já foi entregue' }, { status: 409 });
    }
    if (cust.status === 'cancelado') {
      return NextResponse.json({ detail: 'Esta custódia foi cancelada' }, { status: 409 });
    }

    // Marcar como entregue
    const hora = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit',
    });

    const updated = await query(
      `UPDATE custodias
       SET status      = 'entregue',
           entregue_em = NOW(),
           updated_at  = NOW()
       WHERE id = $1
       RETURNING *`,
      [cust.id]
    );

    // Registrar evento final com localização (prova operacional)
    await query(
      `INSERT INTO custody_eventos
         (custodia_id, tipo, lat, lng, observacao)
       VALUES ($1, 'entregue', $2, $3, $4)`,
      [
        cust.id,
        lat ?? null, lng ?? null,
        `Retirado por ${cust.destinatario_nome}`,
      ]
    );

    // Notificar remetente (fire-and-forget)
    notificarCustodiaEntregue(
      cust.remetente_id,
      cust.descricao,
      cust.destinatario_nome,
      hora
    ).catch(() => {});

    return NextResponse.json({
      message: 'Retirada confirmada com sucesso',
      entregue_em: updated.rows[0].entregue_em,
      descricao:   cust.descricao,
      destinatario_nome: cust.destinatario_nome,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
