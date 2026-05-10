export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const steps: string[] = [];

  try {
    // Criar tabela push_subscriptions
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL,
        endpoint   TEXT NOT NULL,
        auth       TEXT,
        p256dh     TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, endpoint)
      )
    `);
    steps.push('push_subscriptions table OK');

    // Índice para busca por user_id
    await query(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
      ON push_subscriptions (user_id)
    `);
    steps.push('idx_push_subscriptions_user_id OK');

    // Garantir que a tabela notifications existe
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL,
        title      TEXT NOT NULL,
        message    TEXT,
        type       TEXT DEFAULT 'info',
        read       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    steps.push('notifications table OK');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id
      ON notifications (user_id)
    `);
    steps.push('idx_notifications_user_id OK');

    return Response.json({ ok: true, steps });
  } catch (err) {
    return Response.json({ ok: false, error: String(err), steps }, { status: 500 });
  }
}
