import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

// GET /api/v1/delivery/entregador/entregas
// Lista entregas ativas e recentes do entregador autenticado
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Buscar id do entregador
    const entregador = await query(
      'SELECT id FROM entregadores WHERE user_id = $1 LIMIT 1',
      [auth.user.id]
    );

    if (entregador.rows.length === 0) {
      return NextResponse.json({ detail: 'Não é entregador' }, { status: 404 });
    }

    const entregadorId = entregador.rows[0].id;

    const res = await query(
      `SELECT id, token, destinatario_nome, destinatario_phone,
              endereco_destino, status, created_at, entregue_em
       FROM entregas
       WHERE entregador_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [entregadorId]
    );

    return NextResponse.json({ items: res.rows });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
