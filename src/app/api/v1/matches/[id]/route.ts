export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

export async function POST(
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

    const body = await request.json();
    const { action } = body; // 'confirm' ou 'reject'

    if (!action || !['confirm', 'reject'].includes(action)) {
      return successResponse({ detail: 'Action must be confirm or reject' }, 400);
    }

    // Buscar match
    const matchResult = await query(
      `SELECT m.id, m.lost_object_id, m.found_object_id, lo.user_id as lost_user_id, fo.user_id as found_user_id
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE m.id = $1`,
      [params.id]
    );

    if (matchResult.rows.length === 0) {
      return notFoundResponse();
    }

    const match = matchResult.rows[0];

    // Verificar se o usuário é proprietário de um dos objetos
    if (payload.sub !== match.lost_user_id && payload.sub !== match.found_user_id) {
      return unauthorizedResponse();
    }

    // Atualizar status do match
    const status = action === 'confirm' ? 'confirmed' : 'rejected';
    const result = await query(
      `UPDATE matches SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, params.id]
    );

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
