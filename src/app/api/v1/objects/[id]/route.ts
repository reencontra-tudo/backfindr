export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';

export async function GET(
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

    // Buscar objeto
    const result = await query(
      `SELECT id, title, description, status, type, location, latitude, longitude, qr_code, images, created_at, updated_at 
       FROM objects 
       WHERE id = $1 AND user_id = $2`,
      [params.id, payload.sub]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function PATCH(
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
    const { title, description, status, location, latitude, longitude } = body;

    // Atualizar objeto
    const result = await query(
      `UPDATE objects 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           location = COALESCE($4, location),
           latitude = COALESCE($5, latitude),
           longitude = COALESCE($6, longitude),
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING id, title, description, status, type, location, latitude, longitude, qr_code, images, created_at, updated_at`,
      [title, description, status, location, latitude, longitude, params.id, payload.sub]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse(result.rows[0]);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function DELETE(
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

    // Deletar objeto
    const result = await query(
      `DELETE FROM objects 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [params.id, payload.sub]
    );

    if (result.rows.length === 0) {
      return notFoundResponse();
    }

    return successResponse({ message: 'Object deleted successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
