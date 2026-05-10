export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();

    // Aceita tanto o formato PushSubscription.toJSON() quanto campos diretos
    const endpoint = body.endpoint as string | undefined;
    const auth     = (body.keys?.auth   ?? body.auth)   as string | null | undefined;
    const p256dh   = (body.keys?.p256dh ?? body.p256dh) as string | null | undefined;

    if (!endpoint) {
      return successResponse({ detail: 'endpoint is required' }, 400);
    }

    // Garantir que a tabela existe (idempotente)
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

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (user_id, endpoint) DO UPDATE SET updated_at = NOW()`,
      [payload.sub, endpoint, auth ?? null, p256dh ?? null]
    );

    return successResponse({ message: 'Subscription registered' }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
