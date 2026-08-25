export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { Events } from '@/lib/events';

// Consolidado em 25/08/2026 — esta rota aceitava QUALQUER string em `status`,
// sem validação nenhuma (achado no mapeamento de status pedido em 23/08).
// 'archived' fica de fora de propósito: é setado só pela moderação
// (api/v1/admin/moderacao/route.ts) quando um objeto é denunciado/oculto,
// nunca uma escolha do próprio dono. Lista completa em src/types/index.ts.
const OWNER_SETTABLE_STATUSES = ['lost', 'found', 'returned', 'stolen', 'protected'];

function normalizeObject(row: Record<string, unknown>) {
  const lat = row.latitude ? parseFloat(String(row.latitude)) : null;
  const lng = row.longitude ? parseFloat(String(row.longitude)) : null;
  let location = null;
  if (lat && lng && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    location = { lat, lng, address: (row.location as string) || undefined };
  } else if (row.location && typeof row.location === 'string') {
    try {
      const p = JSON.parse(row.location as string);
      if (p.lat && p.lng) location = p;
    } catch { /* não é JSON */ }
  }
  let photos: string[] = [];
  try {
    if (Array.isArray(row.images)) photos = row.images as string[];
    else if (typeof row.images === 'string') photos = JSON.parse(row.images as string);
  } catch { photos = []; }
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    category: row.category || row.type || 'other',
    unique_code: row.qr_code,
    owner_id: row.user_id,
    photos,
    location,
    color: row.color,
    brand: row.brand,
    pet_breed: row.breed,
    is_legacy: row.is_legacy,
    source: row.source,
    reward_amount: row.reward_amount ? parseFloat(String(row.reward_amount)) : null,
    reward_description: row.reward_description || null,
    // found_pending_confirmation/found_pending_since (25/08/2026, item 3b) —
    // ver comentário completo em FoundBanner (dashboard/objects/[id]/page.tsx).
    found_pending_confirmation: row.found_pending_confirmation ?? false,
    found_pending_since: row.found_pending_since ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();
    const result = await query(
      `SELECT id, title, description, status, category, type, location, latitude, longitude,
              qr_code, images, color, brand, breed, is_legacy, source, user_id,
              reward_amount, reward_description, found_pending_confirmation, found_pending_since,
              created_at, updated_at
       FROM objects WHERE id = $1 AND user_id = $2`,
      [params.id, payload.sub]
    );
    if (result.rows.length === 0) return notFoundResponse();
    return successResponse(normalizeObject(result.rows[0] as Record<string, unknown>));
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();
    const body = await request.json();
    const {
      title, description, status, category, type, location, latitude, longitude, images,
      reward_amount, reward_description,
      // found_pending_confirmation: só o dono some com o sinal (confirmando
      // devolução ou descartando via "Ainda não recebi") — ver FoundBanner.
      found_pending_confirmation,
    } = body;

    if (status && !OWNER_SETTABLE_STATUSES.includes(status)) {
      return errorResponse(`Status inválido. Permitidos: ${OWNER_SETTABLE_STATUSES.join(', ')}`, 400);
    }

    // Buscar status atual antes do update (para evento statusChanged)
    const currentResult = await query(
      'SELECT status FROM objects WHERE id = $1 AND user_id = $2',
      [params.id, payload.sub]
    );
    const previousStatus = currentResult.rows[0]?.status as string | undefined;

    const result = await query(
      `UPDATE objects
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           category = COALESCE($4, category),
           type = COALESCE($4, type),
           location = COALESCE($5, location),
           latitude = COALESCE($6, latitude),
           longitude = COALESCE($7, longitude),
           images = COALESCE($8, images),
           reward_amount = COALESCE($9, reward_amount),
           reward_description = COALESCE($10, reward_description),
           found_pending_confirmation = COALESCE($13, found_pending_confirmation),
           -- resolved_at: populado quando o dono confirma devolução (FoundBanner
           -- → "Confirmar devolução" → status='returned'), 23/08/2026. Coluna já
           -- existia órfã na tabela; visibility segue órfão de propósito (fora de
           -- escopo — ver backlog de status em BACKFINDR.md seção 17).
           resolved_at = CASE WHEN $3 = 'returned' THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING id, title, description, status, category, type, location, latitude, longitude,
                 qr_code, images, color, brand, breed, is_legacy, source, user_id,
                 reward_amount, reward_description, found_pending_confirmation, found_pending_since,
                 resolved_at, created_at, updated_at`,
      [title, description, status, category || type, location, latitude, longitude,
       images ? JSON.stringify(images) : null,
       reward_amount !== undefined ? reward_amount : null,
       reward_description !== undefined ? reward_description : null,
       params.id, payload.sub,
       typeof found_pending_confirmation === 'boolean' ? found_pending_confirmation : null]
    );
    if (result.rows.length === 0) return notFoundResponse();

    // ── Eventos de status ──────────────────────────────────────────────
    if (status && previousStatus && status !== previousStatus) {
      Events.statusChanged(params.id, previousStatus, status, payload.sub as string).catch(() => {});
      if (status === 'returned') {
        Events.objectReturned(params.id, payload.sub as string).catch(() => {});
      }
    }

    return successResponse(normalizeObject(result.rows[0] as Record<string, unknown>));
  } catch (error) {
    return internalErrorResponse(error);
  }
}

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
      `DELETE FROM objects WHERE id = $1 AND user_id = $2 RETURNING id`,
      [params.id, payload.sub]
    );
    if (result.rows.length === 0) return notFoundResponse();
    return successResponse({ message: 'Object deleted successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
