import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/admin/marketing/apify ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(
      `SELECT * FROM marketing_apify_configs ORDER BY created_at DESC`
    );
    return NextResponse.json({ configs: result.rows });
  } catch (error) {
    console.error('[marketing/apify GET]', error);
    return NextResponse.json({ detail: 'Erro ao buscar configurações' }, { status: 500 });
  }
}

// ─── POST /api/v1/admin/marketing/apify ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
      actor_id = 'powerai/facebook-post-search-scraper',
      keyword,
      rede = 'facebook',
      max_results = 100,
      ativo = true,
    } = body;

    if (!keyword) {
      return NextResponse.json({ detail: 'keyword é obrigatória' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO marketing_apify_configs (actor_id, keyword, rede, max_results, ativo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [actor_id, keyword, rede, max_results, ativo]
    );

    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    console.error('[marketing/apify POST]', error);
    return NextResponse.json({ detail: 'Erro ao criar configuração' }, { status: 500 });
  }
}

// ─── PATCH /api/v1/admin/marketing/apify ─────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ detail: 'id é obrigatório' }, { status: 400 });

    const allowedFields = ['actor_id', 'keyword', 'rede', 'max_results', 'ativo'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        values.push(updates[field]);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ detail: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    await query(
      `UPDATE marketing_apify_configs SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/apify PATCH]', error);
    return NextResponse.json({ detail: 'Erro ao atualizar configuração' }, { status: 500 });
  }
}

// ─── DELETE /api/v1/admin/marketing/apify ────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ detail: 'id é obrigatório' }, { status: 400 });

    await query(`DELETE FROM marketing_apify_configs WHERE id = $1`, [parseInt(id)]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/apify DELETE]', error);
    return NextResponse.json({ detail: 'Erro ao excluir configuração' }, { status: 500 });
  }
}
