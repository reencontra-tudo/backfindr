import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { notFoundResponse, internalErrorResponse, successResponse } from '@/lib/response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Buscar perfil público do usuário
    const result = await query(
      'SELECT id, name, created_at FROM users WHERE id = $1',
      [params.id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
