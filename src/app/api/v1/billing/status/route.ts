export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

// GET /api/v1/billing/status — status detalhado do plano para o frontend
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return unauthorizedResponse();
    }

    const payload = verifyToken(token);
    if (!payload) {
      return unauthorizedResponse();
    }

    const result = await query(
      'SELECT id, email, name, plan, plan_expires_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse();
    }

    const user = result.rows[0];
    const plan = user.plan || 'free';
    const isPro = plan === 'pro';

    // Verificar se o plano pro expirou
    const isProActive = isPro && (
      !user.plan_expires_at || new Date(user.plan_expires_at) > new Date()
    );

    return successResponse({
      plan: isProActive ? 'pro' : 'free',
      is_pro: isProActive,
      plan_expires_at: user.plan_expires_at,
      features: {
        max_objects: isProActive ? -1 : 3,        // -1 = ilimitado
        ai_matching: isProActive,
        push_notifications: isProActive,
        priority_support: isProActive,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
