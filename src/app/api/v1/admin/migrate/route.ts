import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(s => s.trim()) || [];
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

// POST /api/v1/admin/migrate — executa migrations pendentes
// Requer autenticação de admin (ADMIN_IDS no env) ou MIGRATION_SECRET no body
export async function POST(req: NextRequest) {
  let authorized = false;

  try {
    // Método 1: MIGRATION_SECRET no body
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch { /* sem body */ }

    if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) {
      authorized = true;
    } else {
      // Método 2: JWT de admin
      const authHeader = req.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);
      if (token) {
        const payload = verifyToken(token);
        if (payload && (ADMIN_IDS.length === 0 || ADMIN_IDS.includes(payload.sub))) {
          authorized = true;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const migrations: { name: string; sql: string }[] = [
    {
      name: 'add_reward_amount_to_objects',
      sql: `ALTER TABLE objects ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(10,2) DEFAULT NULL`,
    },
    {
      name: 'add_reward_description_to_objects',
      sql: `ALTER TABLE objects ADD COLUMN IF NOT EXISTS reward_description TEXT DEFAULT NULL`,
    },
  ];

  const results: { name: string; status: string; error?: string }[] = [];

  for (const migration of migrations) {
    try {
      await query(migration.sql);
      results.push({ name: migration.name, status: 'ok' });
    } catch (err) {
      results.push({ name: migration.name, status: 'error', error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
