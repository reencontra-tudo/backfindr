import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, backendHeaders } from '@/lib/adminGuard';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await fetch(`${API}/api/v1/admin/stats`, {
      headers: backendHeaders(req),
      next: { revalidate: 30 }, // cache 30s
    });

    if (!res.ok) throw new Error('Backend error');

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      total_users: 0, new_users_today: 0, new_users_week: 0,
      total_objects: 0, lost_objects: 0, found_objects: 0,
      returned_objects: 0, pending_matches: 0, confirmed_matches: 0,
      rejected_matches: 0, total_scans_today: 0, active_users_week: 0,
    });
  }
}
