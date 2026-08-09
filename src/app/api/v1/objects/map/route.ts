// GET /api/v1/objects/map
// Endpoint otimizado para o mapa: retorna apenas os campos necessários para plotar os pins.
// Payload ~10x menor que /objects/public. Cache de 2 minutos no Vercel Edge.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // LIMIT alto o suficiente pra cobrir todo o universo elegível atual (~1525
    // em ago/2026, a maioria dado histórico legado do Webjetos) com folga pra
    // crescimento — não é mais um corte amostral. Antes disso, um LIMIT 1000
    // ordenado só por updated_at DESC deixava de fora quase todo o status
    // "lost" sempre que uma migração em lote tocava o updated_at de um monte
    // de registro "stolen" de uma vez, distorcendo os contadores por status
    // do mapa (que são calculados a partir desta mesma lista, no cliente).
    const [result, returnedCountResult] = await Promise.all([
      query(
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
         LIMIT 5000`,
        []
      ),
      // Total real de objetos recuperados — não vem da lista de pins acima
      // porque "returned" nem entra no filtro de status dela (item já
      // recuperado não precisa de pin pedindo ajuda). O front usa esse
      // número pra decidir se mostra o botão "Recuperado" pra quem não é
      // admin, evitando exibir um filtro que hoje sempre daria 0 resultado.
      query(`SELECT COUNT(*)::int AS count FROM objects WHERE is_public = true AND status = 'returned'`, []),
    ]);

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

    const returnedTotal = (returnedCountResult.rows[0]?.count as number) ?? 0;

    return NextResponse.json(
      { items, count: items.length, returned_total: returnedTotal },
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
