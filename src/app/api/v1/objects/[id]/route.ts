export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

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
              qr_code, images, color, brand, breed, is_legacy, source, user_id, created_at, updated_at
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
    const { title, description, status, category, type, location, latitude, longitude, images } = body;
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
           updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING id, title, description, status, category, type, location, latitude, longitude,
                 qr_code, images, color, brand, breed, is_legacy, source, user_id, created_at, updated_at`,
      [title, description, status, category || type, location, latitude, longitude,
       images ? JSON.stringify(images) : null, params.id, payload.sub]
    );
    if (result.rows.length === 0) return notFoundResponse();
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
