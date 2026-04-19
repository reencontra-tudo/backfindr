export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

export async function POST(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Buscar objeto pelo QR code
    const objectResult = await query(
      `SELECT id, user_id, title FROM objects WHERE qr_code = $1`,
      [params.code]
    );

    if (objectResult.rows.length === 0) {
      return notFoundResponse();
    }

    const object = objectResult.rows[0] as { id: string; user_id: string; title: string };

    // Registrar scan na tabela de scans (se existir) e criar notificação para o dono
    await query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        object.user_id,
        'Seu objeto foi encontrado! 🎉',
        `Alguém escaneou o QR Code do seu objeto "${object.title}" e quer devolvê-lo.`,
        'scan',
      ]
    );

    // Atualizar status para 'found' se estava 'lost'
    await query(
      `UPDATE objects SET status = 'found', updated_at = NOW()
       WHERE id = $1 AND status = 'lost'`,
      [object.id]
    );

    return successResponse({ message: 'Owner notified successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
