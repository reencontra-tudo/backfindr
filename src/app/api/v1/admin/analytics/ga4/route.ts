export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '534569932';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await res.json();
  return data.access_token ?? null;
}

async function getValidToken(userId: string): Promise<{ token: string; userId: string } | null> {
  const result = await query(
    `SELECT access_token, refresh_token, expires_at FROM analytics_tokens WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as {
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
  };

  const isExpired = row.expires_at
    ? new Date(row.expires_at).getTime() < Date.now() + 5 * 60 * 1000
    : false;

  if (!isExpired) return { token: row.access_token, userId };

  if (row.refresh_token) {
    const newToken = await refreshAccessToken(row.refresh_token);
    if (newToken) {
      const newExpires = new Date(Date.now() + 3600 * 1000).toISOString();
      await query(
        `UPDATE analytics_tokens SET access_token = $1, expires_at = $2, updated_at = NOW() WHERE user_id = $3`,
        [newToken, newExpires, userId]
      );
      return { token: newToken, userId };
    }
  }

  return null;
}

// ─── GA4 helpers ──────────────────────────────────────────────────────────────

type GA4Report = {
  rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[];
};

async function runReport(
  accessToken: string,
  dateRange: { startDate: string; endDate: string },
  metrics: string[],
  dimensions?: string[],
  limit = 10
): Promise<GA4Report> {
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GA4 API error: ${JSON.stringify(err)}`);
  }

  return res.json();
}

async function runRealtimeReport(
  accessToken: string,
  metrics: string[],
  dimensions?: string[]
): Promise<GA4Report> {
  const body: Record<string, unknown> = {
    metrics: metrics.map(name => ({ name })),
  };
  if (dimensions?.length) {
    body.dimensions = dimensions.map(name => ({ name }));
  }

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runRealtimeReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  return res.json();
}

function metricVal(report: GA4Report, rowIndex: number, metricIndex: number): number {
  const val = report.rows?.[rowIndex]?.metricValues?.[metricIndex]?.value;
  return val ? parseFloat(val) : 0;
}

function dimVal(report: GA4Report, rowIndex: number, dimIndex: number): string {
  return report.rows?.[rowIndex]?.dimensionValues?.[dimIndex]?.value ?? '';
}

// ─── Rota principal ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const url = new URL(req.url);
  const range = (url.searchParams.get('range') ?? '30d') as '7d' | '30d' | '90d';

  const rangeMap: Record<string, string> = {
    '7d':  '7daysAgo',
    '30d': '30daysAgo',
    '90d': '90daysAgo',
  };
  const startDate = rangeMap[range] ?? '30daysAgo';
  const dateRange = { startDate, endDate: 'today' };

  const tokenData = await getValidToken(user.id);
  if (!tokenData) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const { token } = tokenData;

  try {
    // Todas as requisições em paralelo para mínima latência
    const [
      reportOverview,
      reportPrevPeriod,
      reportRealtime,
      reportRealtimePages,
      reportTopPages,
      reportSources,
      reportDevices,
      reportCities,
      reportDailySessions,
      reportHourly,
      reportLandingPages,
      reportExitPages,
    ] = await Promise.all([

      // 1. Métricas gerais do período
      runReport(token, dateRange, [
        'sessions',
        'activeUsers',
        'newUsers',
        'screenPageViews',
        'bounceRate',
        'averageSessionDuration',
        'engagedSessions',
        'engagementRate',
      ], undefined, 1),

      // 2. Período anterior (para calcular delta %)
      runReport(token, {
        startDate: range === '7d'  ? '14daysAgo' :
                   range === '30d' ? '60daysAgo' : '180daysAgo',
        endDate: range === '7d'  ? '8daysAgo' :
                 range === '30d' ? '31daysAgo' : '91daysAgo',
      }, [
        'sessions',
        'activeUsers',
        'screenPageViews',
        'newUsers',
      ], undefined, 1),

      // 3. Usuários em tempo real
      runRealtimeReport(token, ['activeUsers']),

      // 4. Páginas ativas agora (tempo real)
      runRealtimeReport(token, ['activeUsers'], ['unifiedPagePathScreen']),

      // 5. Top 10 páginas por pageviews
      runReport(token, dateRange, [
        'screenPageViews',
        'activeUsers',
        'averageSessionDuration',
        'bounceRate',
      ], ['pagePath'], 10),

      // 6. Fontes de tráfego (canal agrupado)
      runReport(token, dateRange, [
        'sessions',
        'activeUsers',
        'newUsers',
        'bounceRate',
      ], ['sessionDefaultChannelGrouping'], 10),

      // 7. Dispositivos
      runReport(token, dateRange, [
        'sessions',
        'activeUsers',
        'bounceRate',
      ], ['deviceCategory'], 5),

      // 8. Cidades (top 10)
      runReport(token, dateRange, [
        'activeUsers',
        'sessions',
      ], ['city'], 10),

      // 9. Série diária de sessões (para gráfico de linha)
      runReport(token, dateRange, [
        'sessions',
        'activeUsers',
        'screenPageViews',
      ], ['date'], 90),

      // 10. Atividade por hora do dia
      runReport(token, dateRange, [
        'activeUsers',
        'sessions',
      ], ['hour'], 24),

      // 11. Páginas de entrada (landing pages)
      runReport(token, dateRange, [
        'sessions',
        'bounceRate',
        'newUsers',
      ], ['landingPage'], 10),

      // 12. Páginas de saída
      runReport(token, dateRange, [
        'screenPageViews',
        'exits',
      ], ['pagePath'], 10),
    ]);

    // ── Processar overview ────────────────────────────────────────────────────
    const ov = {
      sessions:              metricVal(reportOverview, 0, 0),
      active_users:          metricVal(reportOverview, 0, 1),
      new_users:             metricVal(reportOverview, 0, 2),
      pageviews:             metricVal(reportOverview, 0, 3),
      bounce_rate:           parseFloat((metricVal(reportOverview, 0, 4) * 100).toFixed(1)),
      avg_session_duration:  Math.round(metricVal(reportOverview, 0, 5)),
      engaged_sessions:      metricVal(reportOverview, 0, 6),
      engagement_rate:       parseFloat((metricVal(reportOverview, 0, 7) * 100).toFixed(1)),
    };

    // ── Deltas vs período anterior ────────────────────────────────────────────
    const prev = {
      sessions:     metricVal(reportPrevPeriod, 0, 0),
      active_users: metricVal(reportPrevPeriod, 0, 1),
      pageviews:    metricVal(reportPrevPeriod, 0, 2),
      new_users:    metricVal(reportPrevPeriod, 0, 3),
    };

    const delta = (curr: number, prev: number) =>
      prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;

    const deltas = {
      sessions:     delta(ov.sessions,     prev.sessions),
      active_users: delta(ov.active_users, prev.active_users),
      pageviews:    delta(ov.pageviews,    prev.pageviews),
      new_users:    delta(ov.new_users,    prev.new_users),
    };

    // ── Realtime ──────────────────────────────────────────────────────────────
    const realtime_users = parseInt(
      reportRealtime.rows?.[0]?.metricValues?.[0]?.value ?? '0'
    );

    const realtime_pages = (reportRealtimePages.rows ?? []).map(row => ({
      page:  dimVal({ rows: [row] }, 0, 0),
      users: parseInt(row.metricValues?.[0]?.value ?? '0'),
    })).slice(0, 5);

    // ── Top páginas ───────────────────────────────────────────────────────────
    const top_pages = (reportTopPages.rows ?? []).map(row => ({
      path:          dimVal({ rows: [row] }, 0, 0),
      pageviews:     Math.round(metricVal({ rows: [row] }, 0, 0)),
      users:         Math.round(metricVal({ rows: [row] }, 0, 1)),
      avg_duration:  Math.round(metricVal({ rows: [row] }, 0, 2)),
      bounce_rate:   parseFloat((metricVal({ rows: [row] }, 0, 3) * 100).toFixed(1)),
    }));

    // ── Fontes de tráfego ─────────────────────────────────────────────────────
    const traffic_sources = (reportSources.rows ?? []).map(row => ({
      channel:     dimVal({ rows: [row] }, 0, 0),
      sessions:    Math.round(metricVal({ rows: [row] }, 0, 0)),
      users:       Math.round(metricVal({ rows: [row] }, 0, 1)),
      new_users:   Math.round(metricVal({ rows: [row] }, 0, 2)),
      bounce_rate: parseFloat((metricVal({ rows: [row] }, 0, 3) * 100).toFixed(1)),
    }));

    // ── Dispositivos ──────────────────────────────────────────────────────────
    const devices = (reportDevices.rows ?? []).map(row => ({
      device:      dimVal({ rows: [row] }, 0, 0),
      sessions:    Math.round(metricVal({ rows: [row] }, 0, 0)),
      users:       Math.round(metricVal({ rows: [row] }, 0, 1)),
      bounce_rate: parseFloat((metricVal({ rows: [row] }, 0, 2) * 100).toFixed(1)),
    }));

    // ── Cidades ───────────────────────────────────────────────────────────────
    const top_cities = (reportCities.rows ?? []).map(row => ({
      city:    dimVal({ rows: [row] }, 0, 0),
      users:   Math.round(metricVal({ rows: [row] }, 0, 0)),
      sessions: Math.round(metricVal({ rows: [row] }, 0, 1)),
    }));

    // ── Série diária ──────────────────────────────────────────────────────────
    const daily_series = (reportDailySessions.rows ?? []).map(row => {
      const raw = dimVal({ rows: [row] }, 0, 0); // ex: "20260601"
      const label = raw.length === 8
        ? `${raw.slice(6, 8)}/${raw.slice(4, 6)}`
        : raw;
      return {
        label,
        sessions:  Math.round(metricVal({ rows: [row] }, 0, 0)),
        users:     Math.round(metricVal({ rows: [row] }, 0, 1)),
        pageviews: Math.round(metricVal({ rows: [row] }, 0, 2)),
      };
    });

    // ── Atividade por hora ────────────────────────────────────────────────────
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const row = (reportHourly.rows ?? []).find(
        r => parseInt(dimVal({ rows: [r] }, 0, 0)) === h
      );
      return {
        hour:     h,
        users:    row ? Math.round(metricVal({ rows: [row] }, 0, 0)) : 0,
        sessions: row ? Math.round(metricVal({ rows: [row] }, 0, 1)) : 0,
      };
    });

    // ── Landing pages ─────────────────────────────────────────────────────────
    const landing_pages = (reportLandingPages.rows ?? []).map(row => ({
      page:        dimVal({ rows: [row] }, 0, 0),
      sessions:    Math.round(metricVal({ rows: [row] }, 0, 0)),
      bounce_rate: parseFloat((metricVal({ rows: [row] }, 0, 1) * 100).toFixed(1)),
      new_users:   Math.round(metricVal({ rows: [row] }, 0, 2)),
    }));

    // ── Exit pages ────────────────────────────────────────────────────────────
    const exit_pages = (reportExitPages.rows ?? []).map(row => ({
      page:      dimVal({ rows: [row] }, 0, 0),
      pageviews: Math.round(metricVal({ rows: [row] }, 0, 0)),
      exits:     Math.round(metricVal({ rows: [row] }, 0, 1)),
    }));

    return NextResponse.json({
      connected: true,
      property_id: GA4_PROPERTY_ID,
      range,
      realtime: {
        users: realtime_users,
        active_pages: realtime_pages,
      },
      overview: ov,
      deltas,
      top_pages,
      traffic_sources,
      devices,
      top_cities,
      daily_series,
      hourly,
      landing_pages,
      exit_pages,
    });

  } catch (err) {
    console.error('[analytics/ga4] error:', err);
    return NextResponse.json({
      connected: true,
      error: 'Erro ao buscar métricas do GA4',
      detail: String(err),
    }, { status: 500 });
  }
}
