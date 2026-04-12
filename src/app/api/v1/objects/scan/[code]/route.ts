import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Buscar objeto pelo QR code (público)
    const result = await query(
      `SELECT id, title, description, status, type, location, latitude, longitude, qr_code, created_at 
       FROM objects 
       WHERE qr_code = $1`,
      [params.code]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse(result.rows[0]);
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

    // Registrar notificação (simplificado)
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [object.user_id, 'QR Code Escaneado', message || 'Seu objeto foi encontrado!', 'qr_scan']
    );

    return successResponse({ message: 'Notification sent' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
