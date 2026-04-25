export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

/**
 * GET /api/v1/admin/analytics?range=30d|7d|90d|1y
 *
 * Retorna métricas estilo Google Analytics:
 * - Visão geral (usuários, objetos, matches, receita)
 * - Séries temporais (usuários, objetos, scans, matches por dia)
 * - Funil de conversão (cadastro → objeto → match → recuperação)
 * - Retenção (usuários ativos por semana)
 * - Distribuição por plano, categoria, status
 * - Top categorias e top dias da semana
 * - Métricas de receita (MRR, ARR, ARPU)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url  = new URL(req.url);
  const range = url.searchParams.get('range') ?? '30d';

  // Mapear range para intervalo SQL
  const intervalMap: Record<string, string> = {
    '7d':  '7 days',
    '30d': '30 days',
    '90d': '90 days',
    '1y':  '365 days',
  };
  const interval = intervalMap[range] ?? '30 days';

  // Granularidade: dia para ≤90d, semana para 1y
  const granularity = range === '1y' ? 'week' : 'day';
  const dateFormat  = range === '1y' ? 'DD/MM' : 'DD/MM';

  try {
    const [
      // ── Visão geral ──────────────────────────────────────────────────────────
      totalUsers,
      newUsersInRange,
      prevNewUsers,
      totalObjects,
      newObjectsInRange,
      prevNewObjects,
      totalMatches,
      newMatchesInRange,
      confirmedMatches,
      returnedObjects,
      totalScans,
      scansInRange,

      // ── Receita ──────────────────────────────────────────────────────────────
      proSubs,
      bizSubs,
      freeSubs,

      // ── Séries temporais ─────────────────────────────────────────────────────
      usersSeries,
      objectsSeries,
      matchesSeries,
      scansSeries,

      // ── Funil ────────────────────────────────────────────────────────────────
      usersWithObjects,
      usersWithMatches,
      usersWithReturned,

      // ── Distribuição ─────────────────────────────────────────────────────────
      byPlan,
      byCategory,
      byStatus,
      byMatchStatus,

      // ── Retenção semanal (últimas 8 semanas) ─────────────────────────────────
      weeklyRetention,

      // ── Top dias da semana (atividade) ───────────────────────────────────────
      activityByDow,

      // ── Heatmap horário (últimos 30d) ────────────────────────────────────────
      activityByHour,

    ] = await Promise.all([
      // Totais gerais
      query(`SELECT COUNT(*)::int AS count FROM users`),
      query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= NOW() - INTERVAL '${interval}' * 2 AND created_at < NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(*)::int AS count FROM objects`),
      query(`SELECT COUNT(*)::int AS count FROM objects WHERE created_at >= NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(*)::int AS count FROM objects WHERE created_at >= NOW() - INTERVAL '${interval}' * 2 AND created_at < NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(*)::int AS count FROM matches`),
      query(`SELECT COUNT(*)::int AS count FROM matches WHERE created_at >= NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(*)::int AS count FROM matches WHERE status = 'confirmed'`),
      query(`SELECT COUNT(*)::int AS count FROM objects WHERE status = 'returned'`),
      query(`SELECT COUNT(*)::int AS count FROM notifications WHERE type IN ('qr_scan', 'scan')`),
      query(`SELECT COUNT(*)::int AS count FROM notifications WHERE type IN ('qr_scan', 'scan') AND created_at >= NOW() - INTERVAL '${interval}'`),

      // Planos
      query(`SELECT COUNT(*)::int AS count FROM users WHERE plan = 'pro'`),
      query(`SELECT COUNT(*)::int AS count FROM users WHERE plan = 'business'`),
      query(`SELECT COUNT(*)::int AS count FROM users WHERE plan = 'free' OR plan IS NULL`),

      // Séries temporais
      query(`
        SELECT TO_CHAR(DATE_TRUNC('${granularity}', created_at), '${dateFormat}') AS label,
               COUNT(*)::int AS value
        FROM users
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('${granularity}', created_at)
        ORDER BY DATE_TRUNC('${granularity}', created_at)
      `),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('${granularity}', created_at), '${dateFormat}') AS label,
               COUNT(*)::int AS value
        FROM objects
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('${granularity}', created_at)
        ORDER BY DATE_TRUNC('${granularity}', created_at)
      `),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('${granularity}', created_at), '${dateFormat}') AS label,
               COUNT(*)::int AS value
        FROM matches
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('${granularity}', created_at)
        ORDER BY DATE_TRUNC('${granularity}', created_at)
      `),
      query(`
        SELECT TO_CHAR(DATE_TRUNC('${granularity}', created_at), '${dateFormat}') AS label,
               COUNT(*)::int AS value
        FROM notifications
        WHERE type IN ('qr_scan', 'scan')
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('${granularity}', created_at)
        ORDER BY DATE_TRUNC('${granularity}', created_at)
      `),

      // Funil
      query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM objects`),
      query(`
        SELECT COUNT(DISTINCT o.user_id)::int AS count
        FROM matches m
        JOIN objects o ON o.id = m.lost_object_id OR o.id = m.found_object_id
      `),
      query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM objects WHERE status = 'returned'`),

      // Distribuição
      query(`SELECT plan, COUNT(*)::int AS count FROM users GROUP BY plan ORDER BY count DESC`),
      query(`
        SELECT COALESCE(category, type, 'other') AS label, COUNT(*)::int AS count
        FROM objects
        GROUP BY COALESCE(category, type, 'other')
        ORDER BY count DESC
        LIMIT 8
      `),
      query(`SELECT status, COUNT(*)::int AS count FROM objects GROUP BY status ORDER BY count DESC`),
      query(`SELECT status, COUNT(*)::int AS count FROM matches GROUP BY status ORDER BY count DESC`),

      // Retenção semanal (usuários que criaram objetos nas últimas 8 semanas)
      query(`
        SELECT TO_CHAR(DATE_TRUNC('week', created_at), 'DD/MM') AS week,
               COUNT(DISTINCT user_id)::int AS active_users
        FROM objects
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at)
      `),

      // Atividade por dia da semana
      query(`
        SELECT TO_CHAR(created_at, 'Dy') AS dow,
               EXTRACT(DOW FROM created_at)::int AS dow_num,
               COUNT(*)::int AS count
        FROM objects
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY TO_CHAR(created_at, 'Dy'), EXTRACT(DOW FROM created_at)
        ORDER BY dow_num
      `),

      // Heatmap por hora do dia
      query(`
        SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
               COUNT(*)::int AS count
        FROM objects
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `),
    ]);

    // ── Calcular métricas derivadas ───────────────────────────────────────────
    const PLAN_PRICES: Record<string, number> = { pro: 29.90, business: 79.90 };
    const proCount  = proSubs.rows[0].count as number;
    const bizCount  = bizSubs.rows[0].count as number;
    const freeCount = freeSubs.rows[0].count as number;
    const mrr       = proCount * PLAN_PRICES.pro + bizCount * PLAN_PRICES.business;
    const totalU    = totalUsers.rows[0].count as number;
    const arpu      = totalU > 0 ? parseFloat((mrr / totalU).toFixed(2)) : 0;

    const newU      = newUsersInRange.rows[0].count as number;
    const prevU     = prevNewUsers.rows[0].count as number;
    const newO      = newObjectsInRange.rows[0].count as number;
    const prevO     = prevNewObjects.rows[0].count as number;
    const newM      = newMatchesInRange.rows[0].count as number;
    const newS      = scansInRange.rows[0].count as number;

    const delta = (curr: number, prev: number) =>
      prev === 0 ? null : parseFloat((((curr - prev) / prev) * 100).toFixed(1));

    // ── Funil de conversão ────────────────────────────────────────────────────
    const funnelSteps = [
      { label: 'Cadastros',     value: totalU,                                        pct: 100 },
      { label: 'Com objetos',   value: usersWithObjects.rows[0].count as number,      pct: 0 },
      { label: 'Com matches',   value: usersWithMatches.rows[0].count as number,      pct: 0 },
      { label: 'Recuperações',  value: usersWithReturned.rows[0].count as number,     pct: 0 },
    ];
    funnelSteps.forEach((s, i) => {
      if (i > 0) s.pct = totalU > 0 ? parseFloat(((s.value / totalU) * 100).toFixed(1)) : 0;
    });

    // ── Taxa de recuperação ───────────────────────────────────────────────────
    const totalO       = totalObjects.rows[0].count as number;
    const returnedO    = returnedObjects.rows[0].count as number;
    const recoveryRate = totalO > 0 ? parseFloat(((returnedO / totalO) * 100).toFixed(1)) : 0;

    // ── Converter séries para arrays ──────────────────────────────────────────
    type SeriesRow = { label: string; value: number };
    const toSeries = (rows: SeriesRow[]) => rows.map(r => ({ label: r.label, value: r.value }));

    return NextResponse.json({
      range,
      overview: {
        total_users:       totalU,
        new_users:         newU,
        new_users_delta:   delta(newU, prevU),
        total_objects:     totalO,
        new_objects:       newO,
        new_objects_delta: delta(newO, prevO),
        total_matches:     totalMatches.rows[0].count as number,
        new_matches:       newM,
        confirmed_matches: confirmedMatches.rows[0].count as number,
        returned_objects:  returnedO,
        recovery_rate:     recoveryRate,
        total_scans:       totalScans.rows[0].count as number,
        new_scans:         newS,
        mrr,
        arr:               mrr * 12,
        arpu,
      },
      revenue: {
        mrr,
        arr:         mrr * 12,
        arpu,
        pro_count:   proCount,
        biz_count:   bizCount,
        free_count:  freeCount,
        plan_dist: [
          { label: 'Free',     value: freeCount, color: '#6b7280' },
          { label: 'Pro',      value: proCount,  color: '#14b8a6' },
          { label: 'Business', value: bizCount,  color: '#8b5cf6' },
        ],
      },
      series: {
        users:   toSeries(usersSeries.rows   as SeriesRow[]),
        objects: toSeries(objectsSeries.rows as SeriesRow[]),
        matches: toSeries(matchesSeries.rows as SeriesRow[]),
        scans:   toSeries(scansSeries.rows   as SeriesRow[]),
      },
      funnel: funnelSteps,
      retention: (weeklyRetention.rows as { week: string; active_users: number }[]).map(r => ({
        week: r.week,
        active_users: r.active_users,
      })),
      distributions: {
        by_category:     (byCategory.rows    as { label: string; count: number }[]).map(r => ({ label: r.label, value: r.count })),
        by_status:       (byStatus.rows      as { status: string; count: number }[]).map(r => ({ label: r.status, value: r.count })),
        by_match_status: (byMatchStatus.rows as { status: string; count: number }[]).map(r => ({ label: r.status, value: r.count })),
      },
      activity: {
        by_dow:  (activityByDow.rows  as { dow: string; count: number }[]).map(r => ({ label: r.dow, value: r.count })),
        by_hour: (activityByHour.rows as { hour: number; count: number }[]).map(r => ({ hour: r.hour, value: r.count })),
      },
    });
  } catch (err) {
    console.error('[analytics] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
