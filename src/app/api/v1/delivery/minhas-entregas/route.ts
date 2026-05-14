import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

function generateToken(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// GET /api/v1/delivery/minhas-entregas
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT id, token, destinatario_nome, destinatario_phone,
              endereco_destino, status, created_at, entregue_em
       FROM entregas
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [auth.user.id]
    );
    return NextResponse.json({ items: res.rows });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST /api/v1/delivery/minhas-entregas
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { destinatario_nome, destinatario_phone, endereco_destino, entregador_phone } = body;

    if (!destinatario_nome || !destinatario_phone || !endereco_destino) {
      return NextResponse.json(
        { detail: 'Nome, telefone e endereço do destinatário são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar entregador pelo telefone (opcional)
    let entregadorId = null;
    if (entregador_phone) {
      const entregador = await query(
        'SELECT id FROM entregadores WHERE phone = $1 AND active = true LIMIT 1',
        [entregador_phone.replace(/\D/g, '')]
      );
      if (entregador.rows.length > 0) {
        entregadorId = entregador.rows[0].id;
      }
    }

    const token = generateToken();

    const res = await query(
      `INSERT INTO entregas
         (user_id, destinatario_nome, destinatario_phone, endereco_destino, 
          entregador_id, status, token)
       VALUES ($1, $2, $3, $4, $5, 'aguardando', $6)
       RETURNING *`,
      [auth.user.id, destinatario_nome, destinatario_phone, 
       endereco_destino, entregadorId, token]
    );

    const entrega = res.rows[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003';

    return NextResponse.json({
      ...entrega,
      entregador_vinculado: entregadorId !== null,
      link_url: `${appUrl}/delivery/${token}`,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
