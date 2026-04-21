import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────
// Estratégia de duas camadas:
// 1. Se BACKEND_API_URL estiver definido → delega ao FastAPI (futuro Render)
// 2. Caso contrário → consulta o banco PostgreSQL diretamente
// Para migrar para FastAPI: basta definir BACKEND_API_URL no Vercel.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // ── Camada 1: FastAPI (opcional, futuro Render) ───────────────────────────
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/v1/admin/stats`, {
        headers: backendHeaders(req),
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // FastAPI indisponível — cai para camada 2
    }
  }

  // ── Camada 2: Consulta direta ao PostgreSQL ───────────────────────────────
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

    const [
      totalUsers, newUsersToday, newUsersWeek, activeUsersWeek,
      totalObjects, lostObjects, foundObjects, returnedObjects,
      pendingMatches, confirmedMatches, rejectedMatches, scansToday,
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
    ]);

    return NextResponse.json({
      total_users:       parseInt(totalUsers.rows[0].count, 10),
      new_users_today:   parseInt(newUsersToday.rows[0].count, 10),
      new_users_week:    parseInt(newUsersWeek.rows[0].count, 10),
      active_users_week: parseInt(activeUsersWeek.rows[0].count, 10),
      total_objects:     parseInt(totalObjects.rows[0].count, 10),
      lost_objects:      parseInt(lostObjects.rows[0].count, 10),
      found_objects:     parseInt(foundObjects.rows[0].count, 10),
      returned_objects:  parseInt(returnedObjects.rows[0].count, 10),
      pending_matches:   parseInt(pendingMatches.rows[0].count, 10),
      confirmed_matches: parseInt(confirmedMatches.rows[0].count, 10),
      rejected_matches:  parseInt(rejectedMatches.rows[0].count, 10),
      total_scans_today: parseInt(scansToday.rows[0].count, 10),
    });
  } catch (err) {
    console.error('[admin/stats] DB error:', err);
    return NextResponse.json({
      total_users: 0, new_users_today: 0, new_users_week: 0, active_users_week: 0,
      total_objects: 0, lost_objects: 0, found_objects: 0, returned_objects: 0,
      pending_matches: 0, confirmed_matches: 0, rejected_matches: 0, total_scans_today: 0,
    });
  }
}
