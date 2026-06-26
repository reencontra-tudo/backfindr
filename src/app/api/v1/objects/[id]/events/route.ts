export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
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

    // Busca eventos ordenados mais recente primeiro
    const eventsResult = await query(
      `SELECT type, title, description, source, metadata, created_at
       FROM object_events
       WHERE object_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [objectId]
    );

    // Summary agregado
    const summaryResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE type = 'qr_scanned')                          AS total_scans,
         COUNT(*) FILTER (WHERE type = 'match_found')                         AS total_matches,
         COUNT(*) FILTER (WHERE type IN ('matching_started','matching_completed')) AS total_ai_runs,
         MAX(created_at)                                                        AS last_activity
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
