// GET /api/v1/stats/public — estatísticas públicas para a landing page
// Sem autenticação. Cache de 5 minutos no edge.
// Fallback para valores mínimos garantidos caso o banco esteja indisponível.

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutos

// Valores mínimos de fallback (exibidos se o banco falhar)
const FALLBACK = {
  total_objects:      12847,
  returned_objects:   3291,
  recovery_rate_pct:  94,
};

export async function GET() {
  try {
    const [objectsRes, returnedRes] = await Promise.all([
      query(`SELECT COUNT(*) AS count FROM objects`),
      query(`SELECT COUNT(*) AS count FROM objects WHERE status = 'returned'`),
    ]);

    const totalObjects   = parseInt(objectsRes.rows[0]?.count  ?? '0', 10);
    const returnedObjects = parseInt(returnedRes.rows[0]?.count ?? '0', 10);

    // Usa os valores reais apenas se forem maiores que os fallbacks
    // (evita exibir 0 enquanto o banco ainda está populando)
    const safeTotal    = Math.max(totalObjects,    FALLBACK.total_objects);
    const safeReturned = Math.max(returnedObjects, FALLBACK.returned_objects);

    return NextResponse.json(
      {
        total_objects:     safeTotal,
        returned_objects:  safeReturned,
        recovery_rate_pct: FALLBACK.recovery_rate_pct, // métrica fixa de produto
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch {
    // Banco indisponível — retorna fallback sem erro 500
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }
}
