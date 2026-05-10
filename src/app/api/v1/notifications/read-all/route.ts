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

    // Marcar todas como lidas
    await query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [payload.sub]
    );

    return successResponse({ message: 'All notifications marked as read' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
