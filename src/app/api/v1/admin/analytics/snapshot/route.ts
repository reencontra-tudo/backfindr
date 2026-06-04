// src/app/api/v1/admin/analytics/snapshot/route.ts
//
// Cron diário que salva um snapshot das métricas no banco.
// Configurar no vercel.json:
//   { "path": "/api/v1/admin/analytics/snapshot", "schedule": "0 8 * * *" }
//
// Também pode ser chamado manualmente via GET com header Authorization.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const CRON_SECRET  = process.env.CRON_SECRET;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '534569932';

// ─── Verifica autorização (cron Vercel ou chamada manual admin) ───────────────

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron envia o header authorization com o CRON_SECRET
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;

  // Fallback: aceita sem secret em dev (NODE_ENV !== production)
  if (process.env.NODE_ENV !== 'production') return true;

  return false;
}

// ─── Busca token GA4 válido do banco ─────────────────────────────────────────

async function getGA4Token(): Promise<string | null> {
  try {
    const result = await query(
      `SELECT access_token, refresh_token, expires_at
       FROM analytics_tokens
       ORDER BY updated_at DESC
       LIMIT 1`
    );
    if (!result.rows.length) return null;

    const row = result.rows[0] as {
      access_token: string;
      refresh_token: string | null;
      expires_at: string | null;
    };

    // Verificar expiração
    const isExpired = row.expires_at
      ? new Date(row.expires_at).getTime() < Date.now() + 5 * 60 * 1000
      : false;

    if (!isExpired) return row.access_token;

    // Renovar token
    if (row.refresh_token) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: row.refresh_token,
          grant_type:    'refresh_token',
        }).toString(),
      });
      const data = await res.json();
      if (data.access_token) {
        const newExpires = new Date(Date.now() + 3600 * 1000).toISOString();
        await query(
          `UPDATE analytics_tokens
           SET access_token = $1, expires_at = $2, updated_at = NOW()
           WHERE refresh_token = $3`,
          [data.access_token, newExpires, row.refresh_token]
        );
        return data.access_token;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Busca métricas GA4 ───────────────────────────────────────────────────────

async function fetchGA4Metrics(token: string) {
  const dateRange = { startDate: '7daysAgo', endDate: 'today' };

  const runReport = async (
    metrics: string[],
    dimensions?: string[],
    limit = 1
  ) => {
    const body: Record<string, unknown> = {
      dateRanges: [dateRange],
      metrics: metrics.map(name => ({ name })),
      limit,
    };
    if (dimensions?.length) {
      body.dimensions = dimensions.map(name => ({ name }));
    }
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    return res.json();
  };

  const [overview, topSource, topPage, realtime] = await Promise.all([
    runReport([
      'sessions', 'activeUsers', 'screenPageViews',
      'newUsers', 'bounceRate', 'averageSessionDuration',
    ]),
    runReport(['sessions'], ['sessionDefaultChannelGrouping'], 1),
    runReport(['screenPageViews'], ['pagePath'], 1),
    fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runRealtimeReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }),
      }
    ).then(r => r.json()),
  ]);

  const m = (report: { rows?: { metricValues: { value: string }[] }[] }, i: number) =>
    parseFloat(report.rows?.[0]?.metricValues?.[i]?.value ?? '0');

  return {
    sessions:             Math.round(m(overview, 0)),
    users:                Math.round(m(overview, 1)),
    pageviews:            Math.round(m(overview, 2)),
    new_users:            Math.round(m(overview, 3)),
    bounce_rate:          parseFloat((m(overview, 4) * 100).toFixed(2)),
    avg_session_duration: parseFloat(m(overview, 5).toFixed(2)),
    realtime_users:       parseInt(realtime.rows?.[0]?.metricValues?.[0]?.value ?? '0'),
    top_source:           topSource.rows?.[0]?.dimensionValues?.[0]?.value ?? null,
    top_page:             topPage.rows?.[0]?.dimensionValues?.[0]?.value ?? null,
  };
}

// ─── Rota principal ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // ── Métricas internas em paralelo ─────────────────────────────────────────
    const [
      usersTotal, usersNew7d,
      objectsTotal, objectsNew7d,
      matchesTotal, matchesConfirmed,
      objectsReturned, objectsAll,
      scansTotal, scansNew7d,
      planCounts,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS n FROM users`),
      query(`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`),
      query(`SELECT COUNT(*)::int AS n FROM objects`),
      query(`SELECT COUNT(*)::int AS n FROM objects WHERE created_at >= NOW() - INTERVAL '7 days'`),
      query(`SELECT COUNT(*)::int AS n FROM matches`),
      query(`SELECT COUNT(*)::int AS n FROM matches WHERE status = 'confirmed'`),
      query(`SELECT COUNT(*)::int AS n FROM objects WHERE status = 'returned'`),
      query(`SELECT COUNT(*)::int AS n FROM objects`),
      query(`SELECT COUNT(*)::int AS n FROM notifications WHERE type IN ('qr_scan','scan')`),
      query(`SELECT COUNT(*)::int AS n FROM notifications WHERE type IN ('qr_scan','scan') AND created_at >= NOW() - INTERVAL '7 days'`),
      query(`SELECT plan, COUNT(*)::int AS n FROM users GROUP BY plan`),
    ]);

    const plans = Object.fromEntries(
      (planCounts.rows as { plan: string; n: number }[]).map(r => [r.plan ?? 'free', r.n])
    );
    const usersFree     = (plans['free'] ?? 0) + (plans[null as unknown as string] ?? 0);
    const usersPro      = plans['pro']      ?? 0;
    const usersBusiness = plans['business'] ?? 0;
    const mrr           = usersPro * 29.90 + usersBusiness * 79.90;

    const totalO      = objectsAll.rows[0].n as number;
    const returnedO   = objectsReturned.rows[0].n as number;
    const recoveryRate = totalO > 0
      ? parseFloat(((returnedO / totalO) * 100).toFixed(2))
      : 0;

    // ── Métricas GA4 (opcional — não falha se não conectado) ──────────────────
    let ga4: Awaited<ReturnType<typeof fetchGA4Metrics>> | null = null;
    const ga4Token = await getGA4Token();
    if (ga4Token) {
      try { ga4 = await fetchGA4Metrics(ga4Token); } catch { /* silencioso */ }
    }

    // ── Upsert no banco (INSERT ou UPDATE se já existe snapshot do dia) ───────
    await query(
      `INSERT INTO analytics_snapshots (
        snapshot_date,
        total_users, new_users_7d,
        total_objects, new_objects_7d,
        total_matches, confirmed_matches,
        returned_objects, recovery_rate,
        total_scans, new_scans_7d,
        users_free, users_pro, users_business, mrr,
        ga4_sessions_7d, ga4_users_7d, ga4_pageviews_7d,
        ga4_new_users_7d, ga4_bounce_rate, ga4_avg_session_duration,
        ga4_realtime_users, ga4_top_source, ga4_top_page
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (snapshot_date) DO UPDATE SET
        total_users            = EXCLUDED.total_users,
        new_users_7d           = EXCLUDED.new_users_7d,
        total_objects          = EXCLUDED.total_objects,
        new_objects_7d         = EXCLUDED.new_objects_7d,
        total_matches          = EXCLUDED.total_matches,
        confirmed_matches      = EXCLUDED.confirmed_matches,
        returned_objects       = EXCLUDED.returned_objects,
        recovery_rate          = EXCLUDED.recovery_rate,
        total_scans            = EXCLUDED.total_scans,
        new_scans_7d           = EXCLUDED.new_scans_7d,
        users_free             = EXCLUDED.users_free,
        users_pro              = EXCLUDED.users_pro,
        users_business         = EXCLUDED.users_business,
        mrr                    = EXCLUDED.mrr,
        ga4_sessions_7d        = EXCLUDED.ga4_sessions_7d,
        ga4_users_7d           = EXCLUDED.ga4_users_7d,
        ga4_pageviews_7d       = EXCLUDED.ga4_pageviews_7d,
        ga4_new_users_7d       = EXCLUDED.ga4_new_users_7d,
        ga4_bounce_rate        = EXCLUDED.ga4_bounce_rate,
        ga4_avg_session_duration = EXCLUDED.ga4_avg_session_duration,
        ga4_realtime_users     = EXCLUDED.ga4_realtime_users,
        ga4_top_source         = EXCLUDED.ga4_top_source,
        ga4_top_page           = EXCLUDED.ga4_top_page,
        captured_at            = NOW()`,
      [
        today,
        usersTotal.rows[0].n,   usersNew7d.rows[0].n,
        objectsTotal.rows[0].n, objectsNew7d.rows[0].n,
        matchesTotal.rows[0].n, matchesConfirmed.rows[0].n,
        returnedO, recoveryRate,
        scansTotal.rows[0].n,   scansNew7d.rows[0].n,
        usersFree, usersPro, usersBusiness, mrr,
        ga4?.sessions ?? null,
        ga4?.users    ?? null,
        ga4?.pageviews ?? null,
        ga4?.new_users ?? null,
        ga4?.bounce_rate ?? null,
        ga4?.avg_session_duration ?? null,
        ga4?.realtime_users ?? null,
        ga4?.top_source ?? null,
        ga4?.top_page   ?? null,
      ]
    );

    return NextResponse.json({
      success: true,
      date: today,
      internal: {
        users:   usersTotal.rows[0].n,
        objects: objectsTotal.rows[0].n,
        matches: matchesTotal.rows[0].n,
        mrr,
      },
      ga4_connected: !!ga4,
    });

  } catch (err) {
    console.error('[analytics/snapshot] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
