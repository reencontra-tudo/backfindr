export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { SIMILAR_OBJECTS_SQL } from '@/lib/governance';

/** GET /api/v1/objects/[id]/similar — outras ocorrências ativas, parecidas, do MESMO usuário ("Cadastrei duas vezes"). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();
    const cur = await query(`SELECT title, category FROM objects_active WHERE id = $1 AND user_id = $2`, [params.id, payload.sub]);
    if (cur.rows.length === 0) return notFoundResponse();
    const { title, category } = cur.rows[0] as { title: string; category: string };
    const res = await query(SIMILAR_OBJECTS_SQL, [payload.sub, params.id, category, title]);
    return successResponse({ items: res.rows });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
