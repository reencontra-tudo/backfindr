import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { nome, phone, veiculo_tipo, veiculo_placa, cnh_url, veiculo_doc_url, selfie_url } = body;

    if (!nome || !phone || !veiculo_tipo) {
      return NextResponse.json(
        { detail: 'Nome, telefone e tipo de veículo são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já é entregador
    const existing = await query(
      'SELECT id, status FROM entregadores WHERE user_id = $1',
      [auth.user.id]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { detail: 'Usuário já cadastrado como entregador', status: existing.rows[0].status },
        { status: 409 }
      );
    }

    const res = await query(
      `INSERT INTO entregadores
         (nome, phone, user_id, veiculo_tipo, veiculo_placa,
          cnh_url, veiculo_doc_url, selfie_url, status, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendente', false)
       RETURNING *`,
      [nome, phone, auth.user.id, veiculo_tipo, veiculo_placa ?? null,
       cnh_url ?? null, veiculo_doc_url ?? null, selfie_url ?? null]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
