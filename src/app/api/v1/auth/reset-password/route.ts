import { NextRequest } from 'next/server';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, new_password } = body;

    if (!token || !new_password) {
      return errorResponse('Token and new password are required', 400);
    }

    if (new_password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    // Hash do token recebido
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar token válido no banco
    const result = await query(
      `SELECT prt.user_id, prt.expires_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return errorResponse('Invalid or expired reset token', 400);
    }

    const { user_id } = result.rows[0];

    // Hash da nova senha
    const hashedPassword = await bcryptjs.hash(new_password, 12);

    // Atualizar senha do usuário
    await query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user_id]
    );

    // Deletar token usado
    await query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user_id]
    );

    return successResponse({ message: 'Password reset successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
