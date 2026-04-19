export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

// GET /api/v1/billing — status do plano atual + histórico de pagamentos
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return errorResponse('Invalid token', 401);
    }

    const result = await query(
      'SELECT id, email, name, plan, stripe_subscription_id, plan_expires_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return errorResponse('User not found', 404);
    }

    const user = result.rows[0];

    // Buscar histórico de assinaturas
    let subscriptionHistory: Array<{
      provider: string;
      plan_id: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
      created_at: string;
    }> = [];
    try {
      const subResult = await query(
        `SELECT provider, plan_id, status, current_period_start, current_period_end, created_at
         FROM subscriptions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [payload.sub]
      );
      subscriptionHistory = subResult.rows;
    } catch { /* tabela pode não existir */ }

    // Determinar provedor ativo
    const isMP = user.stripe_subscription_id?.startsWith('mp_');
    const provider = isMP ? 'mercadopago' : (user.stripe_subscription_id ? 'stripe' : null);

    // Verificar se a assinatura está cancelada (plan_expires_at no passado)
    let isCancelled = false;
    if (user.plan_expires_at) {
      isCancelled = new Date(user.plan_expires_at) < new Date();
    }

    return successResponse({
      plan: user.plan || 'free',
      plan_expires_at: user.plan_expires_at,
      provider,
      subscription_id: user.stripe_subscription_id,
      is_cancelled: isCancelled,
      subscription_history: subscriptionHistory,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// POST /api/v1/billing — ações de billing (upgrade, cancel)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return errorResponse('Invalid token', 401);
    }

    const body = await request.json();
    const { action, plan_slug } = body; // action: 'upgrade' | 'cancel'

    const result = await query(
      'SELECT id, email, name, plan, stripe_subscription_id, plan_expires_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return errorResponse('User not found', 404);
    }

    const user = result.rows[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.backfindr.com';

    if (action === 'upgrade') {
      // Redirecionar para checkout do Mercado Pago
      const slug = plan_slug || 'pro';
      const planPrices: Record<string, { title: string; price: number }> = {
        pro:      { title: 'Backfindr Pro',      price: 29.90 },
        business: { title: 'Backfindr Business', price: 149.90 },
      };
      const plan = planPrices[slug];
      if (!plan) return errorResponse('Plano inválido', 400);

      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken) {
        // Fallback: redirecionar para página de pricing
        return successResponse({ url: `${appUrl}/pricing` });
      }

      const { MercadoPagoConfig, Preference } = await import('mercadopago');
      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const preference = new Preference(client);

      const mpResponse = await preference.create({
        body: {
          items: [{
            id: `plan_${slug}`,
            title: plan.title,
            description: `Assinatura mensal do plano ${plan.title}`,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'BRL',
          }],
          metadata: {
            type: 'plan',
            plan_id: slug,
            user_id: String(payload.sub),
          },
          back_urls: {
            success: `${appUrl}/checkout/success?type=plan&ref=${slug}`,
            failure: `${appUrl}/checkout/failure`,
            pending: `${appUrl}/checkout/pending`,
          },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/v1/webhooks/mercadopago`,
          statement_descriptor: 'BACKFINDR',
          payment_methods: {
            excluded_payment_types: [],
            installments: 1,
          },
        },
      });

      const isSandbox = mpToken.startsWith('TEST-');
      const checkoutUrl = isSandbox ? mpResponse.sandbox_init_point : mpResponse.init_point;

      return successResponse({ url: checkoutUrl, preference_id: mpResponse.id });
    }

    if (action === 'cancel') {
      // Cancelar assinatura: rebaixar para free ao fim do período
      if (!user.stripe_subscription_id) {
        return errorResponse('Nenhuma assinatura ativa', 400);
      }

      const isMP = user.stripe_subscription_id.startsWith('mp_');

      if (isMP) {
        // Para MP: marcar como cancelada na tabela subscriptions
        // O acesso continua até plan_expires_at
        await query(
          `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
           WHERE user_id = $1 AND status = 'active'`,
          [payload.sub]
        );
        return successResponse({
          message: 'Assinatura cancelada. Você terá acesso até o fim do período pago.',
          plan_expires_at: user.plan_expires_at,
        });
      }

      // Para Stripe: usar API do Stripe se disponível
      if (process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        await stripe.subscriptions.update(user.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        return successResponse({
          message: 'Assinatura será cancelada ao fim do período.',
        });
      }

      return errorResponse('Não foi possível cancelar a assinatura', 500);
    }

    return errorResponse('Ação inválida', 400);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
