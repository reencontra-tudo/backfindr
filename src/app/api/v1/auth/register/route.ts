export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import bcryptjs from 'bcryptjs';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';
import { successResponse, errorResponse, conflictResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone } = body;

    // Validação
    if (!name || !email || !password) {
      return errorResponse('Name, email and password are required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    // Verificar se usuário já existe
    const userExists = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userExists.rows.length > 0) {
      return conflictResponse('User with this email already exists');
    }

    // Hash da senha
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Criar usuário
    const result = await query(
      `INSERT INTO users (name, email, password, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name`,
      [name, email.toLowerCase(), hashedPassword, phone || null]
    );

    const user = result.rows[0];

    // Gerar tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    return successResponse(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
}
