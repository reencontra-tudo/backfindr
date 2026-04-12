import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const API_KEY = process.env.INTERNAL_API_KEY ?? '';

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId) {
        await fetch(`${API_URL}/api/v1/billing/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Key': API_KEY },
          body: JSON.stringify({ user_id: userId, plan: 'pro', subscription_id: session.subscription }),
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId) {
        await fetch(`${API_URL}/api/v1/billing/downgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Key': API_KEY },
          body: JSON.stringify({ user_id: userId }),
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Notificar usuário por e-mail
      break;
    }
  }

  return NextResponse.json({ received: true });
}
