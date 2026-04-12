import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// GET /api/v1/billing — status do plano atual
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
      'SELECT id, email, name, plan, stripe_customer_id, stripe_subscription_id, plan_expires_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return errorResponse('User not found', 404);
    }

    const user = result.rows[0];
    let subscriptionDetails = null;

    if (user.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        subscriptionDetails = {
          status: subscription.status,
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        };
      } catch (stripeError) {
        console.error('Error fetching Stripe subscription:', stripeError);
      }
    }

    return successResponse({
      plan: user.plan || 'free',
      plan_expires_at: user.plan_expires_at,
      stripe_customer_id: user.stripe_customer_id,
      subscription: subscriptionDetails,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// POST /api/v1/billing — criar portal de billing do Stripe
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
    const { action } = body; // 'portal' | 'cancel' | 'upgrade'

    const result = await query(
      'SELECT id, email, name, plan, stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return errorResponse('User not found', 404);
    }

    const user = result.rows[0];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.vercel.app';

    if (!process.env.STRIPE_SECRET_KEY) {
      return errorResponse('Stripe not configured', 500);
    }

    if (action === 'portal') {
      // Criar sessão do portal de billing
      let customerId = user.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [customerId, user.id]
        );
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/dashboard`,
      });

      return successResponse({ url: session.url });
    }

    if (action === 'cancel') {
      if (!user.stripe_subscription_id) {
        return errorResponse('No active subscription', 400);
      }

      await stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      return successResponse({ message: 'Subscription will be cancelled at period end' });
    }

    if (action === 'upgrade') {
      // Redirecionar para checkout do Stripe
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
      if (!priceId) {
        return errorResponse('Pro plan price not configured', 500);
      }

      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [customerId, user.id]
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard?upgraded=true`,
        cancel_url: `${appUrl}/pricing`,
        metadata: { user_id: user.id },
      });

      return successResponse({ url: session.url });
    }

    return errorResponse('Invalid action', 400);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
