export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  let dbStatus = 'ok';
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await query('SELECT 1');
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'error';
    console.error('Health check DB error:', error);
  }

  const totalLatency = Date.now() - startTime;
  const status = dbStatus === 'ok' ? 'healthy' : 'degraded';

  return NextResponse.json(
    {
      status,
      version: '1.0.0',
      environment: process.env.ENVIRONMENT || 'production',
      timestamp: new Date().toISOString(),
      latency_ms: totalLatency,
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatency,
        },
        api: {
          status: 'ok',
        },
      },
    },
    { status: status === 'healthy' ? 200 : 503 }
  );
}
