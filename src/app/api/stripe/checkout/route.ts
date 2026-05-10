export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-06-20',
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function POST(request: NextRequest) {
  try {
    const { price_id, success_url, cancel_url } = await request.json();

    // Get user from backend
    const cookieStore = cookies();
    const token = cookieStore.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userRes = await fetch(`${API_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    const user = await userRes.json();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      metadata: { user_id: user.id },
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      locale: 'pt-BR',
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao criar sessão';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
