export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';
import { getUnreadSummary } from '@/lib/chatUnread';

// GET /api/v1/chat/unread — mensagens de chat não lidas do usuário logado: { total, by_match }
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    return successResponse(await getUnreadSummary(payload.sub));
  } catch (error) {
    return internalErrorResponse(error);
  }
}
