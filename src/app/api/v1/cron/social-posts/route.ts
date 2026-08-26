export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { processSocialQueue } from '@/lib/socialPost';

// Este endpoint é chamado pelo Vercel Cron Jobs a cada 5 minutos
// Configuração em vercel.json:
// { "crons": [{ "path": "/api/v1/cron/social-posts", "schedule": "*/5 * * * *" }] }
export async function GET(req: NextRequest) {
  // Verificar autorização (Vercel Cron envia Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed (25/08/2026, rotação do CRON_SECRET): a condição antiga
  // (`cronSecret && ...`) pulava a checagem inteira sem CRON_SECRET
  // configurado — qualquer GET sem nenhum header passava. Agora exige
  // CRON_SECRET configurado E o header batendo com ele.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const result = await processSocialQueue();

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}

// Também aceita POST para disparo manual pelo admin
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const migrationSecret = process.env.MIGRATION_SECRET;

  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (migrationSecret && req.headers.get('x-migration-secret') === migrationSecret);

  if (!isAuthorized) {
    return NextResponse.json({ detail: 'Não autorizado' }, { status: 401 });
  }

  const result = await processSocialQueue();

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
