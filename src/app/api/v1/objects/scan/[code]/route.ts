export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, scanPayload } from '@/lib/pushNotification';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const result = await query(
      `SELECT id, title, description, status, category, type, location, latitude, longitude,
              qr_code, images, color, brand, breed, user_id, is_legacy, source,
              reward_amount, reward_description, created_at, updated_at
       FROM objects
       WHERE qr_code = $1`,
      [params.code]
    );

    if (result.rows.length === 0) return notFoundResponse();

    const row = result.rows[0] as Record<string, unknown>;
    const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
    const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
    let location = null;
    if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      location = { lat, lng, address: (row.location as string) || undefined };
    } else if (row.location && typeof row.location === 'string') {
      try { const p = JSON.parse(row.location as string); if (p.lat && p.lng) location = p; } catch { /* não é JSON */ }
    }
    let photos: string[] = [];
    try {
      if (Array.isArray(row.images)) photos = row.images as string[];
      else if (typeof row.images === 'string') photos = JSON.parse(row.images as string);
    } catch { photos = []; }

    return successResponse({
      id: row.id, title: row.title, description: row.description || '',
      status: row.status, category: row.category || row.type || 'other',
      unique_code: row.qr_code, owner_id: row.user_id, photos, location,
      color: row.color, brand: row.brand, pet_breed: row.breed,
      is_legacy: row.is_legacy, source: row.source,
      reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
      reward_description: row.reward_description || null,
      created_at: row.created_at, updated_at: row.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Notificar proprietário quando QR code é escaneado
    const body = await request.json();
    const { message } = body;

    // Buscar objeto
    const objectResult = await query(
      `SELECT id, user_id FROM objects WHERE qr_code = $1`,
      [params.code]
    );

    if (objectResult.rows.length === 0) {
      return notFoundResponse();
    }

    const object = objectResult.rows[0];

    // Buscar título do objeto para a notificação
    const objDetail = await query(
      `SELECT id, title FROM objects WHERE qr_code = $1`,
      [params.code]
    );
    const objTitle = (objDetail.rows[0] as { id: string; title: string } | undefined)?.title ?? 'objeto';
    const objId    = (objDetail.rows[0] as { id: string; title: string } | undefined)?.id ?? '';

    // Registrar notificação no banco
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [object.user_id, 'QR Code Escaneado', message || `Alguém escaneou o QR Code de "${objTitle}".`, 'qr_scan']
    );

    // Disparar push notification (fire-and-forget)
    sendPushToUser(
      object.user_id as string,
      scanPayload(objTitle, objId)
    ).catch(err => console.error('[push] scan push failed:', err));

    return successResponse({ message: 'Notification sent' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
