export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { Events } from '@/lib/events';
import { successResponse, unauthorizedResponse, internalErrorResponse } from '@/lib/response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const { id: objectId } = params;

    // Verifica que o objeto pertence ao usuário
    const ownerCheck = await query(
      'SELECT id FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );
    if (ownerCheck.rows.length === 0)
      return successResponse({ detail: 'Object not found' }, 404);

    // Busca eventos ordenados mais recente primeiro.
    // Escaneamento REAL = qr_scanned com metadata.via (POST …/notify). A simples ABERTURA da página (qr_scanned sem via) não
    // entra na contagem, na linha do tempo nem na «última atividade»; os registros continuam no banco, nada é apagado.
    const eventsResult = await query(
      `SELECT type, title, description, source, metadata, created_at
       FROM object_events
       WHERE object_id = $1
         AND NOT (type = 'qr_scanned' AND NOT COALESCE(COALESCE(metadata, '{}'::jsonb) ? 'via', false))
       ORDER BY created_at DESC
       LIMIT 20`,
      [objectId]
    );

    // Summary agregado
    const summaryResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE type = 'qr_scanned' AND COALESCE(COALESCE(metadata, '{}'::jsonb) ? 'via', false)) AS total_scans,
         COUNT(*) FILTER (WHERE type = 'match_found')                         AS total_matches,
         COUNT(*) FILTER (WHERE type IN ('matching_started','matching_completed')) AS total_ai_runs,
         MAX(created_at) FILTER (WHERE NOT (type = 'qr_scanned' AND NOT COALESCE(COALESCE(metadata, '{}'::jsonb) ? 'via', false))) AS last_activity
       FROM object_events
       WHERE object_id = $1`,
      [objectId]
    );

    const summary = summaryResult.rows[0] || {};

    // Calcular próxima execução do matching (cron a cada 15 min)
    const CRON_INTERVAL_MS = 15 * 60 * 1000;
    let nextMatchingAt: string | null = null;
    if (summary.last_activity) {
      const lastRun = new Date(summary.last_activity).getTime();
      const next = new Date(lastRun + CRON_INTERVAL_MS);
      // Se já passou, próxima é agora + tempo restante do ciclo atual
      if (next.getTime() < Date.now()) {
        const elapsed = (Date.now() - lastRun) % CRON_INTERVAL_MS;
        nextMatchingAt = new Date(Date.now() + (CRON_INTERVAL_MS - elapsed)).toISOString();
      } else {
        nextMatchingAt = next.toISOString();
      }
    }

    return successResponse({
      events: eventsResult.rows,
      summary: {
        total_scans:      Number(summary.total_scans   || 0),
        total_matches:    Number(summary.total_matches || 0),
        total_ai_runs:    Number(summary.total_ai_runs || 0),
        last_activity:    summary.last_activity || null,
        next_matching_at: nextMatchingAt,
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// Registro de uso do QR pelo dono (baixar ou imprimir). Só o dono autenticado; dono legado não grava.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) return unauthorizedResponse();

    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const action = body?.action;
    if (action !== 'qr_downloaded' && action !== 'qr_printed') {
      return successResponse({ detail: 'Ação inválida' }, 400);
    }
    const format = typeof body?.format === 'string' ? body.format.slice(0, 40) : undefined;

    const { id: objectId } = params;
    const ownerCheck = await query(
      'SELECT id FROM objects WHERE id = $1 AND user_id = $2',
      [objectId, payload.sub]
    );
    if (ownerCheck.rows.length === 0)
      return successResponse({ detail: 'Object not found' }, 404);

    const metadata = { format };
    if (action === 'qr_downloaded') await Events.qrDownloaded(objectId, payload.sub, metadata);
    else await Events.qrPrinted(objectId, payload.sub, metadata);

    return successResponse({ ok: true });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
