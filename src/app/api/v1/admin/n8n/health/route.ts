import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const N8N_URL = process.env.NEXT_PUBLIC_N8N_URL ?? 'https://n8n-production-b99a.up.railway.app';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${N8N_URL}/healthz`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return NextResponse.json({ status: 'ok', url: N8N_URL });
    }

    return NextResponse.json({ status: 'down', url: N8N_URL }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'down', url: N8N_URL }, { status: 200 });
  }
}
