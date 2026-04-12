import { NextRequest } from 'next/server';
import bcryptjs from 'bcryptjs';
import { query } from '@/lib/db';
import { createAccessToken, createRefreshToken } from '@/lib/jwt';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validação
    if (!username || !password) {
      return errorResponse('Username and password are required', 400);
    }

    // Buscar usuário
    const result = await query(
      'SELECT id, email, password, name FROM users WHERE email = $1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return errorResponse('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Verificar senha
    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      return errorResponse('Invalid credentials', 401);
    }

    // Gerar tokens
    const accessToken = createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken(user.id, user.email);

    return successResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
