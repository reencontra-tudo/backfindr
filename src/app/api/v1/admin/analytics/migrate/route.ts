export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // ── analytics_tokens: tokens OAuth2 do Google Analytics ──────────────────
  try {
    await query(`CREATE TABLE IF NOT EXISTS analytics_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT NOT NULL DEFAULT 'Bearer',
      expires_at TIMESTAMPTZ,
      scope TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_tokens_user ON analytics_tokens(user_id)`);
    results.analytics_tokens = 'OK';
  } catch (e: unknown) { results.analytics_tokens = String(e); }

  return NextResponse.json({ ok: true, results });
}
