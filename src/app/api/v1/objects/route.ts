export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

export async function GET(request: NextRequest) {
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

    // Buscar objetos do usuário
    const result = await query(
      `SELECT id, title, description, status, type, location, latitude, longitude, 
              qr_code, images, created_at, updated_at 
       FROM objects 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [payload.sub]
    );

    return successResponse({
      objects: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
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
    const { title, description, status, type, location, latitude, longitude, images } = body;

    if (!title || !type) {
      return successResponse({ detail: 'Title and type are required' }, 400);
    }

    // Gerar QR code (simplificado - seria um UUID)
    const qrCode = `${payload.sub}-${Date.now()}`;

    // Criar objeto
    const result = await query(
      `INSERT INTO objects (user_id, title, description, status, type, location, latitude, longitude, qr_code, images, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING id, title, description, status, type, location, latitude, longitude, qr_code, images, created_at, updated_at`,
      [payload.sub, title, description || null, status || 'lost', type, location || null, latitude || null, longitude || null, qrCode, JSON.stringify(images || [])]
    );

    return successResponse(result.rows[0], 201);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
