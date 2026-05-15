import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/admin/marketing/leads/[id] ──────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ detail: 'ID inválido' }, { status: 400 });

  try {
    const [leadRes, acoesRes] = await Promise.all([
      query(`SELECT * FROM marketing_leads WHERE id = $1`, [id]),
      query(
        `SELECT * FROM marketing_lead_acoes WHERE lead_id = $1 ORDER BY created_at DESC`,
        [id]
      ),
    ]);

    if (leadRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Lead não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lead: leadRes.rows[0], acoes: acoesRes.rows });
  } catch (error) {
    console.error('[marketing/leads/[id] GET]', error);
    return NextResponse.json({ detail: 'Erro ao buscar lead' }, { status: 500 });
  }
}

// ─── PATCH /api/v1/admin/marketing/leads/[id] ────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ detail: 'ID inválido' }, { status: 400 });

  try {
    const body = await req.json();
    const allowedFields = ['status', 'resposta', 'resolvido', 'comment_link', 'tipo_item'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ detail: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    await query(
      `UPDATE marketing_leads SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Registrar ação se status mudou
    if (body.status) {
      const tipoMap: Record<string, string> = {
        abordado: 'contato',
        convertido: 'conversao',
        descartado: 'descarte',
        respondeu: 'resposta',
      };
      const tipo = tipoMap[body.status] || 'atualizacao';
      await query(
        `INSERT INTO marketing_lead_acoes (lead_id, tipo, nota) VALUES ($1, $2, $3)`,
        [id, tipo, body.nota || `Status alterado para: ${body.status}`]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/leads/[id] PATCH]', error);
    return NextResponse.json({ detail: 'Erro ao atualizar lead' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/admin/marketing/leads/[id] ───────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ detail: 'ID inválido' }, { status: 400 });

  try {
    await query(`DELETE FROM marketing_leads WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/leads/[id] DELETE]', error);
    return NextResponse.json({ detail: 'Erro ao excluir lead' }, { status: 500 });
  }
}
