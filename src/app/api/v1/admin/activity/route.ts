export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── GET /api/v1/admin/activity — atividade recente real do banco ─────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Buscar eventos reais das últimas 24h de múltiplas tabelas
    const [usersRes, objectsRes, matchesRes, scansRes] = await Promise.all([
      // Novos usuários
      query(
        `SELECT 'user_registered' AS type, u.name AS label, u.created_at AS ts
         FROM users u
         ORDER BY u.created_at DESC LIMIT 5`
      ),
      // Novos objetos registrados
      query(
        `SELECT 'object_registered' AS type,
                o.title AS label, o.status, o.category, o.created_at AS ts
         FROM objects o
         ORDER BY o.created_at DESC LIMIT 5`
      ),
      // Matches confirmados
      query(
        `SELECT 'match_confirmed' AS type,
                CONCAT(lo.title, ' × ', fo.title) AS label,
                m.score, m.updated_at AS ts
         FROM matches m
         LEFT JOIN objects lo ON lo.id = m.lost_object_id
         LEFT JOIN objects fo ON fo.id = m.found_object_id
         WHERE m.status = 'confirmed'
         ORDER BY m.updated_at DESC LIMIT 5`
      ),
      // QR Scans (via notificações)
      query(
        `SELECT 'qr_scan' AS type,
                n.message AS label, n.created_at AS ts
         FROM notifications n
         WHERE n.type = 'qr_scan'
         ORDER BY n.created_at DESC LIMIT 5`
      ),
    ]);

    // Unir e ordenar por timestamp
    const events = [
      ...usersRes.rows.map(r => ({ type: r.type, label: r.label, ts: r.ts })),
      ...objectsRes.rows.map(r => ({ type: r.type, label: r.label, status: r.status, category: r.category, ts: r.ts })),
      ...matchesRes.rows.map(r => ({ type: r.type, label: r.label, score: r.score, ts: r.ts })),
      ...scansRes.rows.map(r => ({ type: r.type, label: r.label, ts: r.ts })),
    ]
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 10);

    return NextResponse.json({ items: events });
  } catch (e) {
    console.error('[admin/activity GET]', e);
    return NextResponse.json({ items: [] });
  }
}
