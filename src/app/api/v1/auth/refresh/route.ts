export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, createAccessToken, createRefreshToken } from '@/lib/jwt';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return errorResponse('Refresh token is required', 400);
    }

    // Verificar refresh token
    const payload = verifyToken(refresh_token);
    if (!payload) {
      return errorResponse('Invalid or expired refresh token', 401);
    }

    // Gerar novo access token
    const newAccessToken = createAccessToken(payload.sub, payload.email);
    const newRefreshToken = createRefreshToken(payload.sub, payload.email);

    return successResponse({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'bearer',
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
