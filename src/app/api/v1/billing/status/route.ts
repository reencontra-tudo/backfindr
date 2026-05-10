export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

const PLAN_LIMITS: Record<string, { max_objects: number; ai_matching: boolean; push_notifications: boolean; priority_support: boolean; bulk_qr: boolean }> = {
  free:     { max_objects: 3,   ai_matching: false, push_notifications: false, priority_support: false, bulk_qr: false },
  pro:      { max_objects: 50,  ai_matching: true,  push_notifications: true,  priority_support: false, bulk_qr: false },
  business: { max_objects: 500, ai_matching: true,  push_notifications: true,  priority_support: true,  bulk_qr: true  },
};

// GET /api/v1/billing/status — status detalhado do plano para o frontend
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const result = await query(
      `SELECT id, email, name, plan, plan_expires_at, subscription_provider, mp_subscription_id
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) return unauthorizedResponse();

    const user = result.rows[0] as {
      id: string;
      email: string;
      name: string;
      plan: string;
      plan_expires_at: string | null;
      subscription_provider: string | null;
      mp_subscription_id: string | null;
    };

    const rawPlan = user.plan || 'free';

    // Verificar se o plano pago expirou
    const isPaid = rawPlan !== 'free';
    const isActive = isPaid && (
      !user.plan_expires_at || new Date(user.plan_expires_at) > new Date()
    );
    const effectivePlan = isActive ? rawPlan : 'free';

    const features = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS['free'];

    return successResponse({
      plan:            effectivePlan,
      plan_raw:        rawPlan,
      is_paid:         isActive,
      is_pro:          effectivePlan === 'pro',
      is_business:     effectivePlan === 'business',
      plan_expires_at: user.plan_expires_at,
      provider:        user.subscription_provider ?? (user.mp_subscription_id ? 'mercadopago' : null),
      features,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
