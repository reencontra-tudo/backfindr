import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/admin/financeiro ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // ── Assinantes ativos por plano ──────────────────────────────────────────
    const subsResult = await query(`
      SELECT
        plan,
        COUNT(*) AS count
      FROM users
      WHERE plan IN ('pro', 'business')
        AND (plan_expires_at IS NULL OR plan_expires_at > NOW())
      GROUP BY plan
    `);

    let proCount = 0;
    let businessCount = 0;
    for (const row of subsResult.rows as { plan: string; count: string }[]) {
      if (row.plan === 'pro')      proCount      = parseInt(row.count);
      if (row.plan === 'business') businessCount = parseInt(row.count);
    }

    // Preços dos planos
    const PRO_PRICE      = 29.00;
    const BUSINESS_PRICE = 149.00;

    const mrr = (proCount * PRO_PRICE) + (businessCount * BUSINESS_PRICE);
    const arr = mrr * 12;

    // ── Histórico MRR mensal (últimos 7 meses) ───────────────────────────────
    const mrrHistResult = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', started_at), 'Mon YY') AS month,
        SUM(amount_brl) AS total
      FROM subscriptions
      WHERE status = 'active'
        AND started_at >= NOW() - INTERVAL '7 months'
      GROUP BY DATE_TRUNC('month', started_at)
      ORDER BY DATE_TRUNC('month', started_at) ASC
    `);

    const mrrHistory = (mrrHistResult.rows as { month: string; total: string }[]).map(r => ({
      month: r.month,
      value: parseFloat(r.total || '0'),
    }));

    // ── Receita de boosts ────────────────────────────────────────────────────
    const boostResult = await query(`
      SELECT
        COALESCE(SUM(amount_paid), 0) AS total_boost_revenue,
        COUNT(*) AS total_boosts
      FROM boosts
      WHERE status = 'active'
        AND created_at >= NOW() - INTERVAL '30 days'
    `);

    const boostRevenue = parseFloat((boostResult.rows[0] as { total_boost_revenue: string })?.total_boost_revenue || '0');
    const totalBoosts  = parseInt((boostResult.rows[0] as { total_boosts: string })?.total_boosts || '0');

    // ── Últimas transações (subscriptions + boosts) ──────────────────────────
    const txResult = await query(`
      SELECT
        s.id,
        u.name AS user_name,
        u.email,
        s.plan_slug AS plan,
        s.amount_brl AS amount,
        s.status,
        s.provider,
        TO_CHAR(s.created_at, 'DD/MM/YYYY') AS date
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 20
    `);

    const transactions = (txResult.rows as {
      id: string;
      user_name: string;
      email: string;
      plan: string;
      amount: string;
      status: string;
      provider: string;
      date: string;
    }[]).map(r => ({
      id: r.id,
      user: r.user_name || 'Usuário',
      email: r.email,
      plan: r.plan === 'pro' ? 'Pro' : r.plan === 'business' ? 'Business' : r.plan,
      amount: parseFloat(r.amount || '0'),
      status: r.status === 'active' ? 'paid' : r.status,
      provider: r.provider,
      date: r.date,
    }));

    // ── Total de usuários ────────────────────────────────────────────────────
    const usersResult = await query(`SELECT COUNT(*) AS count FROM users`);
    const totalUsers = parseInt((usersResult.rows[0] as { count: string })?.count || '0');

    const totalObjectsResult = await query(`SELECT COUNT(*) AS count FROM objects`);
    const totalObjects = parseInt((totalObjectsResult.rows[0] as { count: string })?.count || '0');

    // ── Cancelamentos nos últimos 30 dias ────────────────────────────────────
    const cancelResult = await query(`
      SELECT COUNT(*) AS count
      FROM subscriptions
      WHERE status = 'cancelled'
        AND cancelled_at >= NOW() - INTERVAL '30 days'
    `);
    const cancelCount = parseInt((cancelResult.rows[0] as { count: string })?.count || '0');
    const churnRate = proCount + businessCount > 0
      ? parseFloat(((cancelCount / (proCount + businessCount)) * 100).toFixed(1))
      : 0;

    // ── LTV estimado ─────────────────────────────────────────────────────────
    const ltvPro      = proCount      > 0 ? parseFloat(((mrr > 0 ? PRO_PRICE      : 0) * 14).toFixed(2)) : 0;
    const ltvBusiness = businessCount > 0 ? parseFloat(((mrr > 0 ? BUSINESS_PRICE : 0) * 18).toFixed(2)) : 0;

    return NextResponse.json({
      mrr:                  parseFloat(mrr.toFixed(2)),
      arr:                  parseFloat(arr.toFixed(2)),
      pro_subscribers:      proCount,
      business_subscribers: businessCount,
      total_subscribers:    proCount + businessCount,
      boost_revenue_30d:    boostRevenue,
      total_boosts_30d:     totalBoosts,
      churn_rate:           churnRate,
      ltv_pro:              ltvPro,
      ltv_business:         ltvBusiness,
      total_users:          totalUsers,
      total_objects:        totalObjects,
      mrr_history:          mrrHistory,
      transactions,
    });
  } catch (error) {
    console.error('Erro no admin financeiro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
