export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { markConversationRead } from '@/lib/chatUnread';

// POST /api/v1/chat/[matchId]/read — marca como lidas as mensagens recebidas nesta conversa
export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } },
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    // Mesma checagem de participante da rota de mensagens
    const matchResult = await query(
      `SELECT m.id, lo.user_id as lost_user_id, fo.user_id as found_user_id
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE m.id = $1`,
      [params.matchId],
    );
    if (matchResult.rows.length === 0) return notFoundResponse();
    const match = matchResult.rows[0];
    if (payload.sub !== match.lost_user_id && payload.sub !== match.found_user_id) {
      return unauthorizedResponse();
    }

    const marked = await markConversationRead(params.matchId, payload.sub);
    return successResponse({ match_id: params.matchId, marked });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
