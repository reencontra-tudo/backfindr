import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Marcar como lida
    const result = await query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [params.id, payload.sub]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Deletar notificação
    const result = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [params.id, payload.sub]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse({ message: 'Notification deleted' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
