export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, matchConfirmedPayload } from '@/lib/pushNotification';

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

    // Se confirmado, notificar o outro lado via push + notificação no banco
    if (action === 'confirm') {
      // Descobrir qual objeto pertence ao outro usuário (não o que confirmou)
      const otherUserId = payload.sub === match.lost_user_id
        ? match.found_user_id
        : match.lost_user_id;

      // Buscar título do objeto do usuário que confirmou para a notificação
      const myObjectId = payload.sub === match.lost_user_id
        ? match.lost_object_id
        : match.found_object_id;

      const objResult = await query(
        `SELECT title FROM objects WHERE id = $1`,
        [myObjectId]
      );
      const objectTitle = objResult.rows[0]?.title ?? 'objeto';

      if (otherUserId) {
        // Notificação no banco
        await query(
          `INSERT INTO notifications (user_id, title, message, type, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            otherUserId,
            '✅ Match confirmado!',
            `A outra parte confirmou o match para "${objectTitle}". Combine a devolução pelo chat.`,
            'match_confirmed',
          ]
        ).catch(err => console.error('[match confirm] notification insert failed:', err));

        // Push notification — fire-and-forget
        sendPushToUser(otherUserId, matchConfirmedPayload(params.id, objectTitle))
          .catch(err => console.error('[match confirm] push failed:', err));
      }
    }

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
