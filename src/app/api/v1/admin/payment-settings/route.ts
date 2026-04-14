import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/payment-settings — listar todas as configurações
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(
      `SELECT key, value, description, is_secret, updated_at
       FROM payment_settings
       ORDER BY key ASC`
    );

    // Mascarar valores secretos
    const settings = result.rows.map(row => ({
      ...row,
      value: row.is_secret && row.value ? '••••••••' : row.value,
    }));

    return successResponse({ settings });
  } catch {
    return successResponse({ settings: [] });
  }
}

// PATCH /api/v1/admin/payment-settings — atualizar uma ou mais configurações
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const updates: { key: string; value: string }[] = body.updates || [];

    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse('updates array é obrigatório', 400);
    }

    const results = [];
    for (const update of updates) {
      if (!update.key || update.value === undefined) continue;
      await query(
        `UPDATE payment_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
        [update.value, update.key]
      );
      results.push({ key: update.key, status: 'updated' });
    }

    return successResponse({ results });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
