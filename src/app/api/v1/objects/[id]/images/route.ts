export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

/**
 * POST /api/v1/objects/[id]/images
 * Faz upload de imagens (base64) para um objeto existente.
 * Body: { images: string[] } — array de data URIs (data:image/jpeg;base64,...)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();
    const { images } = body as { images: string[] };

    if (!Array.isArray(images) || images.length === 0) {
      return successResponse({ detail: 'images array is required' }, 400);
    }

    // Validar que são data URIs de imagem
    const validImages = images.filter(
      (img) => typeof img === 'string' && img.startsWith('data:image/')
    );

    if (validImages.length === 0) {
      return successResponse({ detail: 'No valid image data URIs provided' }, 400);
    }

    // Verificar que o objeto pertence ao usuário
    const check = await query(
      'SELECT id, images FROM objects WHERE id = $1 AND user_id = $2',
      [params.id, payload.sub]
    );
    if (check.rows.length === 0) return notFoundResponse();

    // Mesclar com imagens existentes (máximo 10)
    let existing: string[] = [];
    try {
      const raw = check.rows[0].images;
      if (Array.isArray(raw)) existing = raw;
      else if (typeof raw === 'string') existing = JSON.parse(raw);
    } catch { existing = []; }

    const merged = [...existing, ...validImages].slice(0, 10);

    // Salvar no banco
    const result = await query(
      `UPDATE objects SET images = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, images`,
      [JSON.stringify(merged), params.id, payload.sub]
    );

    if (result.rows.length === 0) return notFoundResponse();

    let photos: string[] = [];
    try {
      const raw = result.rows[0].images;
      if (Array.isArray(raw)) photos = raw;
      else if (typeof raw === 'string') photos = JSON.parse(raw);
    } catch { photos = []; }

    return successResponse({ photos, count: photos.length });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/**
 * DELETE /api/v1/objects/[id]/images
 * Remove todas as imagens de um objeto.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const result = await query(
      `UPDATE objects SET images = '[]', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [params.id, payload.sub]
    );
    if (result.rows.length === 0) return notFoundResponse();
    return successResponse({ photos: [], count: 0 });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
