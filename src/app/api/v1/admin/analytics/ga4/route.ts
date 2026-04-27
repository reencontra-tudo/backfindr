export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '534569932';

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

  // Verificar se o token ainda é válido (com 5 min de margem)
  const isExpired = row.expires_at
    ? new Date(row.expires_at).getTime() < Date.now() + 5 * 60 * 1000
    : false;

  if (!isExpired) {
    return { token: row.access_token, userId };
  }

  // Tentar renovar com refresh_token
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

async function runReport(
  accessToken: string,
  dateRange: { startDate: string; endDate: string },
  metrics: string[],
  dimensions?: string[]
) {
  const body: Record<string, unknown> = {
    dateRanges: [dateRange],
    metrics: metrics.map(name => ({ name })),
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

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;

  // Verificar se há token conectado
  const tokenData = await getValidToken(user.id);
  if (!tokenData) {
    return NextResponse.json({ connected: false }, { status: 200 });
  }

  const { token } = tokenData;

  try {
    // Buscar métricas em paralelo: últimos 7 dias e últimos 30 dias
    const [report7d, report30d, reportRealtime] = await Promise.all([
      runReport(token, { startDate: '7daysAgo', endDate: 'today' }, [
        'sessions', 'activeUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration',
      ]),
      runReport(token, { startDate: '30daysAgo', endDate: 'today' }, [
        'sessions', 'activeUsers', 'screenPageViews', 'newUsers',
      ]),
      // Usuários ativos nos últimos 30 minutos
      fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runRealtimeReport`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            metrics: [{ name: 'activeUsers' }],
          }),
        }
      ).then(r => r.json()),
    ]);

    const parseMetric = (report: { rows?: { metricValues: { value: string }[] }[] }, index: number): number => {
      const val = report.rows?.[0]?.metricValues?.[index]?.value;
      return val ? parseFloat(val) : 0;
    };

    const metrics7d = {
      sessions: parseMetric(report7d, 0),
      active_users: parseMetric(report7d, 1),
      pageviews: parseMetric(report7d, 2),
      bounce_rate: parseFloat((parseMetric(report7d, 3) * 100).toFixed(1)),
      avg_session_duration: parseFloat(parseMetric(report7d, 4).toFixed(0)),
    };

    const metrics30d = {
      sessions: parseMetric(report30d, 0),
      active_users: parseMetric(report30d, 1),
      pageviews: parseMetric(report30d, 2),
      new_users: parseMetric(report30d, 3),
    };

    const realtimeUsers = reportRealtime.rows?.[0]?.metricValues?.[0]?.value
      ? parseInt(reportRealtime.rows[0].metricValues[0].value)
      : 0;

    return NextResponse.json({
      connected: true,
      property_id: GA4_PROPERTY_ID,
      realtime_users: realtimeUsers,
      last_7_days: metrics7d,
      last_30_days: metrics30d,
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
