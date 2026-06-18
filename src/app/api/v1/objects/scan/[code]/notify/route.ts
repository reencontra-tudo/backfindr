export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, scanPayload } from '@/lib/pushNotification';

export async function POST(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Buscar objeto pelo QR code — incluindo status para distinguir protected
    const objectResult = await query(
      `SELECT id, user_id, title, status FROM objects WHERE qr_code = $1`,
      [params.code]
    );

    if (objectResult.rows.length === 0) {
      return notFoundResponse();
    }

    const object = objectResult.rows[0] as { id: string; user_id: string; title: string; status: string };

    // Mensagem contextual: objeto protegido preventivamente vs objeto perdido
    const isProtected = object.status === 'protected';
    const notifTitle   = isProtected ? 'QR Code escaneado! 📍' : 'Seu objeto foi encontrado! 🎉';
    const notifMessage = isProtected
      ? `Alguém escaneou o QR Code do seu objeto "${object.title}". Verifique se está tudo bem.`
      : `Alguém escaneou o QR Code do seu objeto "${object.title}" e quer devolvê-lo.`;

    // Registrar notificação para o dono
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [object.user_id, notifTitle, notifMessage, 'scan']
    );

    // Atualizar status para 'found' se estava 'lost' ou 'protected'
    await query(
      `UPDATE objects SET status = 'found', updated_at = NOW()
       WHERE id = $1 AND status IN ('lost', 'protected')`,
      [object.id]
    );

    // Disparar push notification (fire-and-forget)
    sendPushToUser(
      object.user_id,
      scanPayload(object.title, object.id)
    ).catch(err => console.error('[push] notify push failed:', err));

    return successResponse({ message: 'Owner notified successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
