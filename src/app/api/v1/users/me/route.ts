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

    // Buscar usuário
    const result = await query(
      'SELECT id, email, name, phone, plan, role, b2b_partner_id, is_verified, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse();
    }

    const user = result.rows[0];

    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      plan: user.plan || 'free',
      role: user.role || 'user',
      b2b_partner_id: user.b2b_partner_id || null,
      is_verified: user.is_verified || false,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();
    const { name, phone } = body;

    // Validar telefone se fornecido
    if (phone !== undefined && phone !== null && phone !== '') {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 13) {
        const { errorResponse } = await import('@/lib/response');
        return errorResponse('Telefone inválido. Use entre 10 e 13 dígitos.', 400);
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone || null); }

    if (updates.length === 0) {
      return successResponse({ message: 'Nenhum campo para atualizar' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(payload.sub);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    const result = await query(
      'SELECT id, email, name, phone, plan, role, b2b_partner_id, is_verified, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [payload.sub]
    );

    const user = result.rows[0];
    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      plan: user.plan || 'free',
      role: user.role || 'user',
      b2b_partner_id: user.b2b_partner_id || null,
      is_verified: user.is_verified || false,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
