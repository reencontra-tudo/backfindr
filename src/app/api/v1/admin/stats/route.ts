import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: adminUser } = auth;

  // ── Admin B2B: redireciona para stats da empresa ──────────────────────────
  // Se o admin tem b2b_partner_id, retorna stats filtradas pelo parceiro
  if (adminUser.role === 'admin' && adminUser.b2b_partner_id) {
    const partnerId = adminUser.b2b_partner_id;
    try {
      const [statsRes, pendingMatchesRes, pendingReportsRes] = await Promise.all([
        query(
          `SELECT
            COUNT(*) FILTER (WHERE o.status IS NOT NULL) AS total_objects,
            COUNT(*) FILTER (WHERE o.status = 'lost')     AS lost_objects,
            COUNT(*) FILTER (WHERE o.status = 'found')    AS found_objects,
            COUNT(*) FILTER (WHERE o.status = 'returned') AS returned_objects,
            COUNT(DISTINCT o.user_id)                     AS total_users
           FROM objects o
           JOIN users u ON u.id = o.user_id
           WHERE u.b2b_partner_id = $1`,
          [partnerId]
        ),
        query(
          `SELECT COUNT(*) FROM matches m
           JOIN objects o ON o.id = m.object_id
           JOIN users u ON u.id = o.user_id
           WHERE u.b2b_partner_id = $1 AND m.status = 'pending'`,
          [partnerId]
        ),
        query(
          `SELECT COUNT(*) FROM reports r
           JOIN objects o ON o.id = r.object_id
           JOIN users u ON u.id = o.user_id
           WHERE u.b2b_partner_id = $1 AND r.status = 'pending'`,
          [partnerId]
        ),
      ]);

      const s = statsRes.rows[0] as Record<string, string>;
      return NextResponse.json({
        total_users:       parseInt(s.total_users,       10),
        new_users_today:   0,
        new_users_week:    0,
        active_users_week: 0,
        total_objects:     parseInt(s.total_objects,     10),
        lost_objects:      parseInt(s.lost_objects,      10),
        found_objects:     parseInt(s.found_objects,     10),
        returned_objects:  parseInt(s.returned_objects,  10),
        pending_matches:   parseInt(pendingMatchesRes.rows[0].count, 10),
        confirmed_matches: 0,
        rejected_matches:  0,
        total_scans_today: 0,
        pending_reports:   parseInt(pendingReportsRes.rows[0].count, 10),
        mrr: 0, arr: 0, total_subscribers: 0, churn_rate: 0, daily_growth: [],
      });
    } catch (err) {
      console.error('[admin/stats B2B] DB error:', err);
      return NextResponse.json({ total_users: 0, total_objects: 0, pending_matches: 0, pending_reports: 0 });
    }
  }

  // ── super_admin / admin global ────────────────────────────────────────────
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/v1/admin/stats`, {
        headers: backendHeaders(req),
        next: { revalidate: 30 },
      });
      if (res.ok) return NextResponse.json(await res.json());
    } catch { /* FastAPI indisponível */ }
  }

  try {
    const now = new Date();
    const startOfDay  = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    const PLAN_PRICES: Record<string, number> = { pro: 29.90, business: 79.90 };

    const [
      totalUsers, newUsersToday, newUsersWeek, activeUsersWeek,
      totalObjects, lostObjects, foundObjects, returnedObjects,
      pendingMatches, confirmedMatches, rejectedMatches, scansToday,
      pendingReports, proSubs, bizSubs, dailyGrowth, dailyObjects,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [startOfDay.toISOString()]),
      query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [startOfWeek.toISOString()]),
      query('SELECT COUNT(DISTINCT user_id) FROM objects WHERE updated_at >= $1', [startOfWeek.toISOString()]),
      query('SELECT COUNT(*) FROM objects'),
      query("SELECT COUNT(*) FROM objects WHERE status = 'lost'"),
      query("SELECT COUNT(*) FROM objects WHERE status = 'found'"),
      query("SELECT COUNT(*) FROM objects WHERE status = 'returned'"),
      query("SELECT COUNT(*) FROM matches WHERE status = 'pending'"),
      query("SELECT COUNT(*) FROM matches WHERE status = 'confirmed'"),
      query("SELECT COUNT(*) FROM matches WHERE status = 'rejected'"),
      query("SELECT COUNT(*) FROM notifications WHERE type = 'qr_scan' AND created_at >= $1", [startOfDay.toISOString()]),
      query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
      query("SELECT COUNT(*) FROM users WHERE plan = 'pro'"),
      query("SELECT COUNT(*) FROM users WHERE plan = 'business'"),
      query(`SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'DD/MM') AS day, COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY DATE_TRUNC('day', created_at) ORDER BY DATE_TRUNC('day', created_at)`),
      query(`SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'DD/MM') AS day, COUNT(*)::int AS count FROM objects WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY DATE_TRUNC('day', created_at) ORDER BY DATE_TRUNC('day', created_at)`),
    ]);

    const proCount  = parseInt(proSubs.rows[0].count, 10);
    const bizCount  = parseInt(bizSubs.rows[0].count, 10);
    const mrr       = (proCount * PLAN_PRICES.pro) + (bizCount * PLAN_PRICES.business);
    const totalSubs = proCount + bizCount;
    const totalU    = parseInt(totalUsers.rows[0].count, 10);
    const churnRate = totalU > 0 ? parseFloat(((totalU - totalSubs) / totalU * 100).toFixed(1)) : 0;

    const growthMap: Record<string, { users: number; objects: number }> = {};
    (dailyGrowth.rows as { day: string; count: number }[]).forEach(r => { growthMap[r.day] = { users: r.count, objects: 0 }; });
    (dailyObjects.rows as { day: string; count: number }[]).forEach(r => {
      if (!growthMap[r.day]) growthMap[r.day] = { users: 0, objects: 0 };
      growthMap[r.day].objects = r.count;
    });
    const daily_growth = Object.entries(growthMap).map(([day, v]) => ({ day, users: v.users, objects: v.objects }));

    return NextResponse.json({
      total_users:           totalU,
      new_users_today:       parseInt(newUsersToday.rows[0].count, 10),
      new_users_week:        parseInt(newUsersWeek.rows[0].count, 10),
      active_users_week:     parseInt(activeUsersWeek.rows[0].count, 10),
      total_objects:         parseInt(totalObjects.rows[0].count, 10),
      lost_objects:          parseInt(lostObjects.rows[0].count, 10),
      found_objects:         parseInt(foundObjects.rows[0].count, 10),
      returned_objects:      parseInt(returnedObjects.rows[0].count, 10),
      pending_matches:       parseInt(pendingMatches.rows[0].count, 10),
      confirmed_matches:     parseInt(confirmedMatches.rows[0].count, 10),
      rejected_matches:      parseInt(rejectedMatches.rows[0].count, 10),
      total_scans_today:     parseInt(scansToday.rows[0].count, 10),
      pending_reports:       parseInt(pendingReports.rows[0].count, 10),
      mrr,
      arr:                   mrr * 12,
      total_subscribers:     totalSubs,
      pro_subscribers:       proCount,
      business_subscribers:  bizCount,
      churn_rate:            churnRate,
      daily_growth,
    });
  } catch (err) {
    console.error('[admin/stats] DB error:', err);
    return NextResponse.json({
      total_users: 0, new_users_today: 0, new_users_week: 0, active_users_week: 0,
      total_objects: 0, lost_objects: 0, found_objects: 0, returned_objects: 0,
      pending_matches: 0, confirmed_matches: 0, rejected_matches: 0, total_scans_today: 0,
      pending_reports: 0, mrr: 0, arr: 0, total_subscribers: 0, churn_rate: 0, daily_growth: [],
    });
  }
}
