export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    // Extrair token do header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse();
    }

    // Verificar token
    const payload = verifyToken(token);
    if (!payload) {
      return unauthorizedResponse();
    }

    // Buscar notificações
    const result = await query(
      `SELECT id, title, message, type, read, created_at 
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [payload.sub]
    );

    return successResponse({
      notifications: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extrair token do header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse();
    }

    // Verificar token
    const payload = verifyToken(token);
    if (!payload) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { endpoint, auth, p256dh } = body;

    if (!endpoint) {
      return successResponse({ detail: 'Endpoint is required' }, 400);
    }

    // Registrar subscription de push
    const result = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, endpoint) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [payload.sub, endpoint, auth || null, p256dh || null]
    );

    return successResponse({ message: 'Subscription registered' }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
