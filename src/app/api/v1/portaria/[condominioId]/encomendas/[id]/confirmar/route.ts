export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';
import { notificarEncomendaEntregue } from '@/lib/notifyModulos';

// PATCH /api/v1/portaria/[condominioId]/encomendas/[id]/confirmar
// Porteiro confirma que o morador retirou a encomenda
export async function PATCH(
  req: NextRequest,
  { params }: { params: { condominioId: string; id: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Verificar que a encomenda existe e pertence a este condomínio
    const encRes = await query(
      `SELECT e.*, usr.name AS morador_nome, usr.phone AS morador_telefone
       FROM encomendas e
       LEFT JOIN users usr ON usr.id = e.morador_id
       WHERE e.id = $1 AND e.condominio_id = $2`,
      [params.id, params.condominioId]
    );

    if (encRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Encomenda não encontrada' }, { status: 404 });
    }

    const enc = encRes.rows[0] as {
      id: string; status: string; morador_id: string | null;
      morador_nome: string | null; remetente: string | null;
      morador_telefone: string | null;
    };

    if (enc.status === 'entregue') {
      return NextResponse.json({ detail: 'Encomenda já foi entregue' }, { status: 409 });
    }

    // Atualizar status
    const updated = await query(
      `UPDATE encomendas
       SET status = 'entregue', entregue_em = NOW(),
           entregue_para_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [auth.user.id, params.id]
    );

    // Notificar morador (fire-and-forget)
    if (enc.morador_id) {
      const rem = enc.remetente ?? 'remetente desconhecido';
      notificarEncomendaEntregue(enc.morador_id, rem).catch(() => {});
    }

    return NextResponse.json(updated.rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
