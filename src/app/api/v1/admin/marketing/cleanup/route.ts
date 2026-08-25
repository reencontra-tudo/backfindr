import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Fallback hardcoded removido em 25/08/2026 — ver comentário em
// marketing/webhook/route.ts. Sem a var configurada, fail closed.
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? '';

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === 'true';

  const result = all
    ? await query(`DELETE FROM marketing_leads RETURNING id`, [])
    : await query(`DELETE FROM marketing_leads WHERE data_post < NOW() - INTERVAL '30 days' RETURNING id`, []);

  return NextResponse.json({ deletados: result.rows.length });
}
