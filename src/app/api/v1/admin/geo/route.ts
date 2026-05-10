export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── GET /api/v1/admin/geo — concentração geográfica real ────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Extrair cidade do campo location (texto livre ou JSON)
    // Tentamos extrair o estado/cidade via LIKE nos valores mais comuns do Brasil
    const res = await query(`
      SELECT
        CASE
          WHEN location ILIKE '%São Paulo%' OR location ILIKE '%Sao Paulo%' THEN 'São Paulo, SP'
          WHEN location ILIKE '%Rio de Janeiro%' THEN 'Rio de Janeiro, RJ'
          WHEN location ILIKE '%Belo Horizonte%' THEN 'Belo Horizonte, MG'
          WHEN location ILIKE '%Curitiba%' THEN 'Curitiba, PR'
          WHEN location ILIKE '%Porto Alegre%' THEN 'Porto Alegre, RS'
          WHEN location ILIKE '%Salvador%' THEN 'Salvador, BA'
          WHEN location ILIKE '%Fortaleza%' THEN 'Fortaleza, CE'
          WHEN location ILIKE '%Recife%' THEN 'Recife, PE'
          WHEN location ILIKE '%Brasília%' OR location ILIKE '%Brasilia%' THEN 'Brasília, DF'
          WHEN location ILIKE '%Manaus%' THEN 'Manaus, AM'
          ELSE 'Outras cidades'
        END AS city,
        COUNT(*) AS count
      FROM objects
      WHERE location IS NOT NULL AND location != ''
      GROUP BY city
      ORDER BY count DESC
    `);

    const total = res.rows.reduce((s, r) => s + parseInt(r.count, 10), 0);
    const items = res.rows.map(r => ({
      city: r.city,
      count: parseInt(r.count, 10),
      pct: total > 0 ? Math.round((parseInt(r.count, 10) / total) * 100) : 0,
    }));

    return NextResponse.json({ items, total });
  } catch (e) {
    console.error('[admin/geo GET]', e);
    return NextResponse.json({ items: [], total: 0 });
  }
}
