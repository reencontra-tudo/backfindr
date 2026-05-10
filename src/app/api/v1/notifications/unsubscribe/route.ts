export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

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
    const { endpoint } = body;

    if (!endpoint) {
      return successResponse({ detail: 'Endpoint is required' }, 400);
    }

    // Remover subscription
    await query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [payload.sub, endpoint]
    );

    return successResponse({ message: 'Unsubscribed successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
