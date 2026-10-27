export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { withActor, logEvent } from '@/lib/audit';
import { actorFromPayload, newRequestId, normalizeHelped } from '@/lib/governance';
import { Events } from '@/lib/events';

/**
 * POST /api/v1/objects/[id]/recovered  { helped?: 'sim' | 'nao' }
 * "Encontrei/recuperei o item": marca como recuperado (status 'returned' + resolved_at) em vez de excluir.
 * A pergunta "O Backfindr ajudou?" é opcional e vai só para a trilha (código), sem texto livre.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    let body: { helped?: unknown } | null = null;
    try { body = await request.json(); } catch { body = null; }
    const helped = normalizeHelped(body?.helped);

    const actor = actorFromPayload(payload, 'POST /api/v1/objects/[id]/recovered', newRequestId(request.headers));
    const row = await withActor(actor, async (q) => {
      const prev = await q(`SELECT status FROM objects_active WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [params.id, payload.sub]);
      if (prev.rows.length === 0) return undefined;
      const previousStatus = prev.rows[0].status as string;
      const r = await q(
        `UPDATE objects SET status = 'returned', resolved_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id`, [params.id, payload.sub]);
      await logEvent(q, 'object_recovered', actor, params.id, { previous_status: previousStatus, helped });
      return { id: r.rows[0].id as string, previousStatus };
    });
    if (!row) return notFoundResponse();
    if (row.previousStatus !== 'returned') {
      Events.statusChanged(row.id, row.previousStatus, 'returned', payload.sub as string).catch(() => {});
      Events.objectReturned(row.id, payload.sub as string).catch(() => {});
    }
    return successResponse({ id: row.id, status: 'returned' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
