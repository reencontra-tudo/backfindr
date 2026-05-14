export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/v1/delivery/link/[token]
// Público — cliente acompanha a entrega pelo link recebido no WhatsApp
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const res = await query(
      `SELECT e.id, e.status, e.token,
              e.destinatario_nome, e.endereco_destino,
              e.lat, e.lng, e.created_at, e.entregue_em,
              est.nome AS estabelecimento_nome,
              entr.nome AS entregador_nome
       FROM entregas e
       LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
       LEFT JOIN entregadores entr    ON entr.id = e.entregador_id
       WHERE e.token = $1`,
      [params.token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Link inválido ou expirado' }, { status: 404 });
    }

    const entrega = res.rows[0];

    return NextResponse.json({ ...entrega, eventos: [] });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
