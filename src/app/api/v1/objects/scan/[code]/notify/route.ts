export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, scanPayload } from '@/lib/pushNotification';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Localização opcional enviada pelo finder
    let finderLat: number | null = null;
    let finderLng: number | null = null;
    let finderAddress: string | null = null;
    try {
      const body = await request.json();
      if (body.lat && body.lng) {
        finderLat     = parseFloat(body.lat);
        finderLng     = parseFloat(body.lng);
        finderAddress = body.address ?? null;
      }
    } catch { /* body vazio ou não-JSON — ok */ }

    // Buscar objeto pelo QR code
    const objectResult = await query(
      `SELECT id, user_id, title FROM objects WHERE qr_code = $1`,
      [params.code]
    );

    if (objectResult.rows.length === 0) {
      return notFoundResponse();
    }

    const object = objectResult.rows[0] as { id: string; user_id: string; title: string };

    // Montar mensagem com localização se disponível
    const locationMsg = finderAddress
      ? ` Localização aproximada: ${finderAddress}.`
      : finderLat && finderLng
        ? ` Localização: ${finderLat.toFixed(5)}, ${finderLng.toFixed(5)}.`
        : '';

    // Registrar notificação para o dono com localização
    await query(
      `INSERT INTO notifications (user_id, title, message, type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        object.user_id,
        'Seu objeto foi encontrado! 🎉',
        `Alguém escaneou o QR Code do seu objeto "${object.title}" e quer devolvê-lo.${locationMsg}`,
        'scan',
        JSON.stringify({ object_id: object.id, finder_lat: finderLat, finder_lng: finderLng, finder_address: finderAddress }),
      ]
    );

    // Atualizar status para 'found' se estava 'lost'
    await query(
      `UPDATE objects SET status = 'found', updated_at = NOW()
       WHERE id = $1 AND status = 'lost'`,
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
