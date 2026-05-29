import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

// PATCH /api/v1/admin/comunidade/[id]/comments — aprovar/rejeitar comentário
// Body: { comment_id: string, action: 'approve' | 'reject' | 'delete' }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json() as { comment_id?: string; action?: string };
    const { comment_id, action } = body;

    if (!comment_id || !action) {
      return NextResponse.json({ detail: 'comment_id e action são obrigatórios' }, { status: 400 });
    }

    if (action === 'delete') {
      await query(
        `DELETE FROM community_comments WHERE id = $1 AND post_id = $2`,
        [comment_id, params.id]
      );
      return NextResponse.json({ success: true });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const res = await query(
      `UPDATE community_comments SET status = $1 WHERE id = $2 AND post_id = $3 RETURNING *`,
      [status, comment_id, params.id]
    );

    if (!res.rows.length) {
      return NextResponse.json({ detail: 'Comentário não encontrado' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('[admin/comunidade/[id]/comments PATCH]', err);
    return NextResponse.json({ detail: 'Erro ao moderar comentário' }, { status: 500 });
  }
}
