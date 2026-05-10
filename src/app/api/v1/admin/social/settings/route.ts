export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(
      `SELECT key, value, description FROM social_settings ORDER BY key`
    );

    // Mascarar tokens sensíveis
    const settings = (result.rows as Array<{ key: string; value: string; description: string }>).map((row) => ({
      key: row.key,
      value: row.key.includes('token') && row.value
        ? row.value.substring(0, 8) + '...' + row.value.slice(-4)
        : row.value,
      description: row.description,
    }));

    return NextResponse.json({ settings });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { updates } = body as { updates: Record<string, string> };

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ detail: 'updates é obrigatório' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(updates)) {
      await query(
        `UPDATE social_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
        [String(value), key]
      );
    }

    return NextResponse.json({ ok: true, updated: Object.keys(updates).length });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
