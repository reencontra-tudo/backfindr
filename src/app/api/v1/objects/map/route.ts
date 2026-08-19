// GET /api/v1/objects/map
// Endpoint otimizado para o mapa: retorna apenas os campos necessários para plotar os pins.
// Payload ~10x menor que /objects/public. Cache de 2 minutos no Vercel Edge.
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Teto da query principal. O mapa já cobre escala de renderização via
// clustering nativo do Mapbox no cliente (`cluster: true` em
// src/app/map/client.tsx) — não re-busca por viewport, manda o dataset
// inteiro e deixa o Mapbox agrupar visualmente. Então o risco real aqui
// nunca foi "o mapa não aguenta muito ponto", é este LIMIT cortar objetos
// do resultado sem ninguém perceber. Subido de 5000 pra 20000 (~13x o
// universo elegível de ago/2026, ~1525) e instrumentado abaixo pra nunca
// mais ser silencioso — se algum dia isso disparar de verdade, o log e o
// campo `truncated` no payload avisam antes que vire objeto sumindo do
// mapa sem explicação. Reavaliar viewport pagination de verdade só se a
// causa do crescimento for algo que o clustering não resolva (não é o
// caso hoje: Public Signals cresce por aprovação manual, throughput
// humano, não automação).
const MAP_QUERY_LIMIT = 20000;

export async function GET() {
  try {
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
         LIMIT ${MAP_QUERY_LIMIT + 1}`,
        []
      ),
      // Total real de objetos recuperados — não vem da lista de pins acima
      // porque "returned" nem entra no filtro de status dela (item já
      // recuperado não precisa de pin pedindo ajuda). O front usa esse
      // número pra decidir se mostra o botão "Recuperado" pra quem não é
      // admin, evitando exibir um filtro que hoje sempre daria 0 resultado.
      query(`SELECT COUNT(*)::int AS count FROM objects WHERE is_public = true AND status = 'returned'`, []),
    ]);

    // Buscamos MAP_QUERY_LIMIT+1 de propósito: se essa linha extra veio, é
    // sinal de que existem mais objetos elegíveis do que o teto — descarta
    // ela do resultado, mas registra o estouro em vez de deixar sumir calado.
    const truncated = result.rows.length > MAP_QUERY_LIMIT;
    const rows = truncated ? result.rows.slice(0, MAP_QUERY_LIMIT) : result.rows;
    if (truncated) {
      console.error(
        `[objects/map] LIMIT de ${MAP_QUERY_LIMIT} atingido — existem mais objetos públicos elegíveis do que o teto da query. Objetos estão sendo omitidos do mapa. Subir MAP_QUERY_LIMIT ou implementar paginação real.`
      );
    }

    const items = rows.map((row: Record<string, unknown>) => {
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
      { items, count: items.length, returned_total: returnedTotal, truncated },
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
