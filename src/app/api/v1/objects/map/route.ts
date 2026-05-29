// GET /api/v1/objects/map
// Endpoint otimizado para o mapa: retorna apenas os campos necessários para plotar os pins.
// Payload ~10x menor que /objects/public. Cache de 2 minutos no Vercel Edge.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query(
      `SELECT
         id,
         title,
         status,
         COALESCE(category, type, 'other') AS category,
         latitude,
         longitude,
         location
       FROM objects
       WHERE is_public = true
         AND status IN ('lost', 'found', 'stolen')
         AND (
           (latitude IS NOT NULL AND longitude IS NOT NULL)
           OR (location IS NOT NULL AND location != '' AND location != 'null')
         )
       ORDER BY
         CASE WHEN is_boosted = true THEN 0 ELSE 1 END ASC,
         updated_at DESC NULLS LAST
       LIMIT 1000`,
      []
    );

    const items = result.rows.map((row: Record<string, unknown>) => {
      // Resolver coordenadas
      let lat: number | null = row.latitude ? parseFloat(String(row.latitude)) : null;
      let lng: number | null = row.longitude ? parseFloat(String(row.longitude)) : null;

      if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && row.location && typeof row.location === 'string') {
        try {
          const parsed = JSON.parse(row.location as string);
          if (parsed?.lat && parsed?.lng) {
            lat = parseFloat(String(parsed.lat));
            lng = parseFloat(String(parsed.lng));
          }
        } catch { /* não é JSON */ }
      }

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

      return {
        id: row.id,
        title: row.title,
        status: row.status,
        category: row.category || 'other',
        location: { lat, lng },
      };
    }).filter(Boolean);

    return NextResponse.json(
      { items, count: items.length },
      {
        headers: {
          // Cache de 2 minutos no Vercel Edge CDN + stale-while-revalidate de 30s
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=30',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[objects/map GET]', error);
    return NextResponse.json({ items: [], count: 0 }, { status: 500 });
  }
}
