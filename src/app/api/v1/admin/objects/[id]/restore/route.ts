export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { withActor, logEvent } from '@/lib/audit';
import { adminActor, newRequestId } from '@/lib/governance';

/** POST /api/v1/admin/objects/[id]/restore — restaura uma ocorrência da lixeira (admin). Fica na trilha de auditoria. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const actor = adminActor(auth.user.id, 'POST /api/v1/admin/objects/[id]/restore', newRequestId(req.headers));
    const row = await withActor(actor, async (q) => {
      const r = await q(
        `UPDATE objects
            SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL, deleted_reason_text = NULL, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NOT NULL
        RETURNING id`,
        [params.id]
      );
      if (r.rows.length > 0) await logEvent(q, 'object_restored', actor, params.id, { by: 'admin' });
      return r.rows[0] as { id: string } | undefined;
    });
    if (!row) return NextResponse.json({ detail: 'Ocorrência não está na lixeira' }, { status: 404 });
    return NextResponse.json({ restored: true, id: row.id });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao restaurar' }, { status: 500 }); }
}
