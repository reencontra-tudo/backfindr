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

    // Buscar matches do usuário
    const result = await query(
      `SELECT m.id, m.lost_object_id, m.found_object_id, m.score, m.status, m.created_at, m.updated_at,
              lo.title as lost_title, lo.description as lost_description,
              fo.title as found_title, fo.description as found_description
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE lo.user_id = $1 OR fo.user_id = $1
       ORDER BY m.created_at DESC`,
      [payload.sub]
    );

    return successResponse({
      matches: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
