export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ─── One-off: roda a migration 016 (signal_contact_attempts) ──────────────
// Supabase Studio fora do ar (29/08/2026, não a primeira vez nesta sessão)
// impede aplicar a migration pelo SQL Editor. O banco em si não depende do
// Studio -- esta rota conecta direto via DATABASE_URL, igual qualquer outra
// rota da API. MIGRATION_SECRET no corpo, mesmo padrão já usado em
// classify-legacy-persons/route.ts. Idempotente (IF NOT EXISTS) -- seguro
// chamar mais de uma vez. Apagar depois de confirmado que rodou.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.MIGRATION_SECRET;
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    await query(
      `CREATE TABLE IF NOT EXISTS signal_contact_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        contacted_by UUID NOT NULL REFERENCES users(id),
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_signal_contact_attempts_match_id
       ON signal_contact_attempts(match_id)`
    );

    const check = await query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'signal_contact_attempts' ORDER BY ordinal_position`
    );

    return NextResponse.json({ success: true, columns: check.rows });
  } catch (e) {
    console.error('[run-migration-016]', e);
    return NextResponse.json({ detail: 'Erro ao rodar migration', error: String(e) }, { status: 500 });
  }
}
