import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(s => s.trim()) || [];

// POST /api/v1/admin/migrate — executa migrations pendentes
// Requer autenticação de admin (ADMIN_IDS no env)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || !ADMIN_IDS.includes(payload.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
