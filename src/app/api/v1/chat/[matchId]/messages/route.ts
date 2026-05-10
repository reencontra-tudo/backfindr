export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, chatPayload } from '@/lib/pushNotification';

export async function GET(
  request: NextRequest,
  { params }: { params: { matchId: string } }
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

    // Verificar se o usuário é parte do match
    const matchResult = await query(
      `SELECT m.id, lo.user_id as lost_user_id, fo.user_id as found_user_id
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE m.id = $1`,
      [params.matchId]
    );

    if (matchResult.rows.length === 0) {
      return notFoundResponse();
    }

    const match = matchResult.rows[0];
    if (payload.sub !== match.lost_user_id && payload.sub !== match.found_user_id) {
      return unauthorizedResponse();
    }

    // Buscar mensagens
    const messagesResult = await query(
      `SELECT id, match_id, sender_id, message, created_at 
       FROM chat_messages 
       WHERE match_id = $1 
       ORDER BY created_at ASC`,
      [params.matchId]
    );

    return successResponse({
      match_id: params.matchId,
      messages: messagesResult.rows.map((r: { id: string; match_id: string; sender_id: string; message: string; created_at: string; sender_name?: string; is_system?: boolean }) => ({ ...r, content: r.message })),
      total: messagesResult.rows.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
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
    const { message } = body;

    if (!message) {
      return successResponse({ detail: 'Message is required' }, 400);
    }

    // Verificar se o usuário é parte do match
    const matchResult = await query(
      `SELECT m.id, lo.user_id as lost_user_id, fo.user_id as found_user_id
       FROM matches m
       LEFT JOIN objects lo ON m.lost_object_id = lo.id
       LEFT JOIN objects fo ON m.found_object_id = fo.id
       WHERE m.id = $1`,
      [params.matchId]
    );

    if (matchResult.rows.length === 0) {
      return notFoundResponse();
    }

    const match = matchResult.rows[0];
    if (payload.sub !== match.lost_user_id && payload.sub !== match.found_user_id) {
      return unauthorizedResponse();
    }

     // Inserir mensagem
    const result = await query(
      `INSERT INTO chat_messages (match_id, sender_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, match_id, sender_id, message, created_at`,
      [params.matchId, payload.sub, message]
    );
    const row = result.rows[0];

    // Disparar push para o outro participante do match (fire-and-forget)
    const recipientId = payload.sub === match.lost_user_id
      ? match.found_user_id as string
      : match.lost_user_id as string;

    if (recipientId) {
      // Buscar nome do remetente
      query(`SELECT name FROM users WHERE id = $1`, [payload.sub])
        .then(r => {
          const senderName = (r.rows[0] as { name: string } | undefined)?.name ?? 'Alguém';
          return sendPushToUser(recipientId, chatPayload(senderName, params.matchId, message as string));
        })
        .catch(err => console.error('[push] chat push failed:', err));
    }

    return successResponse({ ...row, content: row.message }, 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
