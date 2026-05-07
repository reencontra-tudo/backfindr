export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

// ── GET /api/v1/users/me ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const result = await query(
      'SELECT id, email, name, phone, plan, role, b2b_partner_id, is_verified, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [payload.sub]
    );
    if (result.rows.length === 0) return unauthorizedResponse();

    const user = result.rows[0];
    return successResponse({
      id:             user.id,
      email:          user.email,
      name:           user.name,
      phone:          user.phone,
      plan:           user.plan || 'free',
      role:           user.role || 'user',
      b2b_partner_id: user.b2b_partner_id || null,
      is_verified:    user.is_verified || false,
      avatar_url:     user.avatar_url,
      created_at:     user.created_at,
      updated_at:     user.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// ── PATCH /api/v1/users/me ────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json();
    const name  = typeof body.name  === 'string' ? body.name.trim()  : undefined;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;

    // Validar telefone se fornecido e não vazio
    if (phone !== undefined && phone.length > 0) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        return new Response(
          JSON.stringify({ error: 'Telefone inválido. Use o formato +55 11 99999-9999.' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name  !== undefined) { fields.push(`name = $${idx++}`);  values.push(name); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }

    if (fields.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum campo para atualizar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    fields.push('updated_at = NOW()');
    values.push(payload.sub);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, email, name, phone, plan, role, b2b_partner_id, is_verified, avatar_url, created_at, updated_at`,
      values
    );

    const user = result.rows[0];
    return successResponse({
      id:             user.id,
      email:          user.email,
      name:           user.name,
      phone:          user.phone,
      plan:           user.plan || 'free',
      role:           user.role || 'user',
      b2b_partner_id: user.b2b_partner_id || null,
      is_verified:    user.is_verified || false,
      avatar_url:     user.avatar_url,
      created_at:     user.created_at,
      updated_at:     user.updated_at,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
