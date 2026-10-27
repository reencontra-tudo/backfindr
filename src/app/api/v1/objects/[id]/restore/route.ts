export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { successResponse, unauthorizedResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { withActor, logEvent } from '@/lib/audit';
import { actorFromPayload, newRequestId, retentionDays } from '@/lib/governance';

/**
 * POST /api/v1/objects/[id]/restore — "Desfazer" da exclusão lógica (dono, dentro do prazo de retenção).
 * Devolve a ocorrência idêntica; a restauração fica na trilha de auditoria.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization'));
    if (!token) return unauthorizedResponse();
    const payload = verifyToken(token);
    if (!payload) return unauthorizedResponse();

    const actor = actorFromPayload(payload, 'POST /api/v1/objects/[id]/restore', newRequestId(request.headers));
    const days = retentionDays();
    const row = await withActor(actor, async (q) => {
      const r = await q(
        `UPDATE objects
            SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, deleted_reason_text = NULL, updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND anonymized_at IS NULL
            AND deleted_at > NOW() - make_interval(days => $3::int)
        RETURNING id, status, category`,
        [params.id, payload.sub, days]
      );
      if (r.rows.length > 0) await logEvent(q, 'object_restored', actor, params.id, { retention_days: days });
      return r.rows[0] as { id: string; status: string; category: string } | undefined;
    });
    if (!row) return notFoundResponse();
    return successResponse({ restored: true, id: row.id });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
