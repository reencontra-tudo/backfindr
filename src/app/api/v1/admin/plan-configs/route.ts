import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/plan-configs — listar todos os planos
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(
      `SELECT id, slug, name, price_brl, max_objects, features, is_active, stripe_price_id, mp_plan_id, updated_at
       FROM plan_configs
       ORDER BY price_brl ASC`
    );
    return successResponse({ plans: result.rows });
  } catch {
    return successResponse({ plans: [] });
  }
}

// POST /api/v1/admin/plan-configs — criar novo plano
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { slug, name, price_brl, max_objects, features, stripe_price_id, mp_plan_id } = body;

    if (!slug || !name || price_brl === undefined || !max_objects) {
      return errorResponse('slug, name, price_brl e max_objects são obrigatórios', 400);
    }

    const result = await query(
      `INSERT INTO plan_configs (slug, name, price_brl, max_objects, features, stripe_price_id, mp_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [slug, name, price_brl, max_objects, JSON.stringify(features || []), stripe_price_id || null, mp_plan_id || null]
    );

    return successResponse({ plan: result.rows[0] }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// PATCH /api/v1/admin/plan-configs — atualizar plano existente
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { slug, ...fields } = body;

    if (!slug) return errorResponse('slug é obrigatório', 400);

    const allowed = ['name', 'price_brl', 'max_objects', 'features', 'is_active', 'stripe_price_id', 'mp_plan_id'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (fields[field] !== undefined) {
        const val = field === 'features' ? JSON.stringify(fields[field]) : fields[field];
        setClauses.push(`${field} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (setClauses.length === 0) return errorResponse('Nenhum campo para atualizar', 400);

    setClauses.push(`updated_at = NOW()`);
    values.push(slug);

    const result = await query(
      `UPDATE plan_configs SET ${setClauses.join(', ')} WHERE slug = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return errorResponse('Plano não encontrado', 404);

    return successResponse({ plan: result.rows[0] });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
