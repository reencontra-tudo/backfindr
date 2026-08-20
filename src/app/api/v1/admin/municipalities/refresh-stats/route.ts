export const dynamic = 'force-dynamic';
// Duração default do Hobby (10s) é suficiente — é uma query agregada única,
// não um loop de 62 chamadas.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── POST /api/v1/admin/municipalities/refresh-stats ───────────────────────
// Recalcula municipalities.total_objects_registered e category_breakdown a
// partir de objects reais, via Haversine (mesma fórmula já usada em
// src/app/api/v1/matching/run/route.ts para candidatos de match — não é
// fórmula nova, é o mesmo cálculo aplicado a um agregado diferente).
//
// Cache periódico, não cálculo ao vivo por request: esta rota é chamada por
// admin (ou, no futuro, por um cron do n8n) e escreve o resultado direto em
// municipalities — as páginas de /achados-perdidos só fazem SELECT desse
// valor já pronto (ver auditoria de SEO de 20/08/2026, item sobre
// force-dynamic em objects/map/route.ts: mesmo princípio aplicado aqui
// desde o desenho, não como correção posterior).
//
// Raio (radius_km) é por cidade, não fixo — populado na migration 009 por
// porte de população. Cidades sem latitude/longitude/radius_km (não
// deveria acontecer nas 62 atuais, mas é defensivo pra cidade nova sem
// dado geocodificado ainda) simplesmente não entram no cálculo e ficam
// zeradas, não quebram a rota.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(`
      WITH matched AS (
        SELECT m.id AS municipality_id, o.category
        FROM municipalities m
        JOIN objects o
          ON o.is_public = true
         AND o.status IN ('lost', 'found', 'stolen')
         AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
         AND m.latitude IS NOT NULL AND m.longitude IS NOT NULL AND m.radius_km IS NOT NULL
         AND (
           6371 * acos(LEAST(1.0,
             cos(radians(m.latitude)) * cos(radians(o.latitude::float)) *
             cos(radians(o.longitude::float) - radians(m.longitude)) +
             sin(radians(m.latitude)) * sin(radians(o.latitude::float))
           ))
         ) <= m.radius_km
      ),
      cat_counts AS (
        SELECT municipality_id, COALESCE(category, 'other') AS category, COUNT(*) AS cnt
        FROM matched
        GROUP BY municipality_id, COALESCE(category, 'other')
      ),
      agg AS (
        SELECT municipality_id, SUM(cnt)::int AS total, jsonb_object_agg(category, cnt) AS category_breakdown
        FROM cat_counts
        GROUP BY municipality_id
      )
      UPDATE municipalities m
      SET total_objects_registered = COALESCE(agg.total, 0),
          category_breakdown = COALESCE(agg.category_breakdown, '{}'::jsonb),
          last_computed_at = NOW()
      FROM municipalities m2
      LEFT JOIN agg ON agg.municipality_id = m2.id
      WHERE m.id = m2.id
      RETURNING m.id, m.slug, m.total_objects_registered, m.category_breakdown;
    `);

    return NextResponse.json({
      ok: true,
      updated: result.rows.length,
      sample: result.rows.slice(0, 5),
    });
  } catch (err) {
    console.error('[admin/municipalities/refresh-stats] erro', err);
    return NextResponse.json({ detail: 'Erro ao recalcular estatísticas.' }, { status: 500 });
  }
}
