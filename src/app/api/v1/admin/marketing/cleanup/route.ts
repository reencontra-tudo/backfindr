import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN ?? 'backfindr-webhook-secret-2024';

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== WEBHOOK_TOKEN) {
    return NextResponse.json({ detail: 'Token inválido' }, { status: 401 });
  }

  const result = await query(
    `DELETE FROM marketing_leads WHERE data_post < NOW() - INTERVAL '30 days' RETURNING id`,
    []
  );

  return NextResponse.json({ deletados: result.rows.length });
}
