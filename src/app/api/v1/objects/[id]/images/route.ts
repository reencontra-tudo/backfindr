export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { uploadMultipleToR2, deleteMultipleFromR2, isR2Url, detectMimeType } from '@/lib/storage';

/**
 * POST /api/v1/objects/[id]/images
 * Faz upload de imagens para um objeto existente.
 * Body: { images: string[] } — array de data URIs (data:image/jpeg;base64,...)
 *
 * Fluxo:
 *  1. Se R2 estiver configurado → faz upload para Cloudflare R2 e salva URLs
 *  2. Se R2 não estiver configurado → salva Base64 no banco (legado)
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

    // ── Upload para R2 (se configurado) ──────────────────────────────────────
    let newImages: string[] = validImages; // fallback: Base64 original

    const r2Configured = !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    );

    if (r2Configured) {
      try {
        const uploads = await uploadMultipleToR2({
          folder: 'objects',
          entityId: params.id,
          images: validImages.map((img) => ({
            data: img,
            mimeType: detectMimeType(img),
          })),
        });
        newImages = uploads.map((u) => u.url);
      } catch (uploadError) {
        console.error('[R2] Upload failed, falling back to Base64:', uploadError);
        // Mantém Base64 como fallback — não quebra o fluxo
        newImages = validImages;
      }
    }

    const merged = [...existing, ...newImages].slice(0, 10);

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

    return successResponse({
      photos,
      count: photos.length,
      storage: r2Configured ? 'r2' : 'base64',
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/**
 * DELETE /api/v1/objects/[id]/images
 * Remove todas as imagens de um objeto (banco + R2).
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

    // Buscar imagens atuais para deletar do R2
    const current = await query(
      'SELECT images FROM objects WHERE id = $1 AND user_id = $2',
      [params.id, payload.sub]
    );
    if (current.rows.length === 0) return notFoundResponse();

    // Deletar do R2 as imagens que são URLs (não Base64)
    try {
      let existingImages: string[] = [];
      const raw = current.rows[0].images;
      if (Array.isArray(raw)) existingImages = raw;
      else if (typeof raw === 'string') existingImages = JSON.parse(raw);

      const r2Keys = existingImages
        .filter(isR2Url)
        .map((url) => {
          // Extrair a key da URL: https://pub-xxx.r2.dev/objects/id/file.jpg → objects/id/file.jpg
          try {
            const u = new URL(url);
            return u.pathname.replace(/^\//, '');
          } catch { return null; }
        })
        .filter(Boolean) as string[];

      if (r2Keys.length > 0) {
        await deleteMultipleFromR2(r2Keys);
      }
    } catch (deleteError) {
      console.error('[R2] Delete failed:', deleteError);
      // Continua mesmo se o delete do R2 falhar
    }

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
