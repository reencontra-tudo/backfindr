import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';

const API     = process.env.NEXT_PUBLIC_API_URL ?? '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';

interface StripeSub {
  id: string;
  status: string;
  plan: { amount: number; interval: string };
  customer: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

async function getStripeData() {
  if (!STRIPE_KEY) return null;

  try {
    const res = await fetch(
      'https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.customer',
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── GET /api/v1/admin/financeiro ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Buscar stats do backend + Stripe em paralelo
  const [statsRes, stripeData] = await Promise.all([
    fetch(`${API}/api/v1/admin/stats`, { headers: backendHeaders(req) }).catch(() => null),
    getStripeData(),
  ]);

  const stats = statsRes?.ok ? await statsRes.json() : {};

  // Calcular MRR do Stripe
  let mrr = 0;
  let arr = 0;
  let proCount = 0;
  let businessCount = 0;
  let failedPayments = 0;
  const subscriptions: StripeSub[] = stripeData?.data ?? [];

  for (const sub of subscriptions) {
    const amount = sub.plan?.amount ?? 0; // centavos
    const interval = sub.plan?.interval ?? 'month';
    const monthly = interval === 'year' ? amount / 12 : amount;
    mrr += monthly / 100; // reais

    if (amount <= 2000) proCount++;       // até R$20 = Pro
    else businessCount++;                  // acima = Business
  }

  arr = mrr * 12;

  // Buscar pagamentos falhos
  if (STRIPE_KEY) {
    try {
      const failRes = await fetch(
        'https://api.stripe.com/v1/payment_intents?limit=20',
        { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
      );
      if (failRes.ok) {
        const failData = await failRes.json();
        failedPayments = (failData.data ?? []).filter(
          (p: { status: string }) => p.status === 'requires_payment_method'
        ).length;
      }
    } catch {}
  }

  const ltvPro      = proCount      > 0 ? ((mrr * 14) / proCount).toFixed(2)      : '0.00';
  const ltvBusiness = businessCount > 0 ? ((mrr * 18) / businessCount).toFixed(2) : '0.00';

  return NextResponse.json({
    mrr:              parseFloat(mrr.toFixed(2)),
    arr:              parseFloat(arr.toFixed(2)),
    pro_subscribers:  proCount,
    business_subscribers: businessCount,
    total_subscribers: proCount + businessCount,
    failed_payments:  failedPayments,
    churn_rate:       2.1,       // TODO: calcular real do Stripe
    ltv_pro:          parseFloat(ltvPro),
    ltv_business:     parseFloat(ltvBusiness),
    cac:              0,
    total_users:      stats.total_users ?? 0,
    total_objects:    stats.total_objects ?? 0,
    stripe_connected: !!STRIPE_KEY,
    // Histórico MRR simulado enquanto não há dados suficientes
    mrr_history: [
      { month: 'Out 25', value: 0 },
      { month: 'Nov 25', value: mrr * 0.05 },
      { month: 'Dez 25', value: mrr * 0.15 },
      { month: 'Jan 26', value: mrr * 0.30 },
      { month: 'Fev 26', value: mrr * 0.50 },
      { month: 'Mar 26', value: mrr * 0.75 },
      { month: 'Abr 26', value: mrr },
    ],
  });
}
