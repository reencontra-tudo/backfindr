export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { withActor, logEvent } from '@/lib/audit';
import { adminActor, newRequestId, resolveDeletion, retentionDays, ADMIN_REASONS } from '@/lib/governance';

// Lista consolidada em 25/08/2026 — faltava 'protected' aqui (status real e
// ativamente usado no dashboard/matching, não sinônimo de 'archived'; ver
// src/types/index.ts para o mapeamento completo dos 6 valores válidos).
const VALID_STATUSES = ['lost', 'found', 'returned', 'stolen', 'protected', 'archived'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const res = await query(
      `SELECT o.id, o.title, o.description, o.status, o.category, o.type, o.qr_code,
              o.location, o.latitude, o.longitude, o.images, o.color, o.brand, o.breed,
              o.is_legacy, o.source, o.reward_amount, o.reward_description,
              o.created_at, o.updated_at,
              u.name AS owner_name, u.email AS owner_email
       FROM objects_active o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [params.id]
    );
    if (res.rows.length === 0) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e) { return NextResponse.json({ detail: 'Erro ao buscar objeto' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ detail: `Status inválido. Permitidos: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }
  try {
    const actor = adminActor(auth.user.id, 'PATCH /api/v1/admin/objects/[id]', newRequestId(req.headers));
    const res = await withActor(actor, (q) => q(
      `UPDATE objects SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, title, status, updated_at`,
      [body.status, params.id]
    ));
    if (res.rows.length === 0) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } catch (e) { return NextResponse.json({ detail: 'Erro ao atualizar objeto' }, { status: 500 }); }
}

/**
 * DELETE (admin) = exclusão LÓGICA com motivo OBRIGATÓRIO (lista fixa ADMIN_REASONS), para auditoria.
 * Body: { reason: 'adm_*', reason_text?: string (só em adm_outro) }. A linha vai para a lixeira (restaurável).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  let body: { reason?: unknown; reason_text?: unknown } | null = null;
  try { body = await req.json(); } catch { body = null; }
  const decision = resolveDeletion('admin', body);
  if (!decision.ok) {
    return NextResponse.json({ detail: `Motivo obrigatório e válido (${decision.error})`, allowed: ADMIN_REASONS.map((r) => r.code) }, { status: 400 });
  }
  try {
    const actor = adminActor(auth.user.id, 'DELETE /api/v1/admin/objects/[id]', newRequestId(req.headers));
    const row = await withActor(actor, async (q) => {
      const r = await q(
        `UPDATE objects
            SET deleted_at = NOW(), deleted_by = $2, deleted_reason = $3, deleted_reason_text = $4, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, status, category`,
        [params.id, auth.user.id, decision.reason, decision.reasonText]
      );
      if (r.rows.length > 0) {
        const o = r.rows[0] as { id: string; status: string; category: string };
        await logEvent(q, 'object_deleted', actor, o.id, { reason: decision.reason, status: o.status, category: o.category, retention_days: retentionDays(), by: 'admin' });
      }
      return r.rows[0] as { id: string; status: string; category: string } | undefined;
    });
    if (!row) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
    return NextResponse.json({ success: true, deleted: true, retention_days: retentionDays() });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao remover objeto' }, { status: 500 }); }
}
