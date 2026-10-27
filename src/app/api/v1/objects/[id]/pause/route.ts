export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { withActor, logEvent } from '@/lib/audit';
import { actorFromPayload, newRequestId } from '@/lib/governance';

/**
 * POST /api/v1/objects/[id]/pause  { paused: boolean }
 * Pausar = ocultar do público (is_public=false) SEM excluir; reativar devolve. Só reativa o que foi pausado
 * pelo dono (paused_at preenchido) — nunca reexpõe o que a moderação ocultou nem o legado.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    let body: { paused?: unknown } | null = null;
    try { body = await request.json(); } catch { body = null; }
    if (typeof body?.paused !== 'boolean') return errorResponse("Informe { paused: true|false }", 400);
    const paused = body.paused;

    const actor = actorFromPayload(payload, 'POST /api/v1/objects/[id]/pause', newRequestId(request.headers));
    const row = await withActor(actor, async (q) => {
      const r = paused
        ? await q(
            `UPDATE objects SET is_public = false, paused_at = NOW(), updated_at = NOW()
              WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND paused_at IS NULL AND COALESCE(is_legacy, false) = false
            RETURNING id, status`, [params.id, payload.sub])
        : await q(
            `UPDATE objects SET is_public = true, paused_at = NULL, updated_at = NOW()
              WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND paused_at IS NOT NULL
            RETURNING id, status`, [params.id, payload.sub]);
      if (r.rows.length > 0) await logEvent(q, paused ? 'object_paused' : 'object_reactivated', actor, params.id, {});
      return r.rows[0] as { id: string; status: string } | undefined;
    });
    if (!row) return notFoundResponse();
    return successResponse({ id: row.id, paused });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
