export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { processSocialQueue } from '@/lib/socialPost';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    const channel = searchParams.get('channel') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const size = Math.min(50, parseInt(searchParams.get('size') ?? '20'));
    const offset = (page - 1) * size;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`sp.status = $${params.length}`);
    }
    if (channel) {
      params.push(channel);
      conditions.push(`sp.channel = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         sp.id, sp.channel, sp.status, sp.post_text, sp.post_url, sp.image_url,
         sp.sent_at, sp.error_message, sp.retry_count, sp.scheduled_for,
         sp.created_at, sp.updated_at,
         o.id as object_id, o.title as object_title, o.status as object_status,
         o.category as object_category, o.qr_code
       FROM social_posts sp
       LEFT JOIN objects o ON o.id = sp.object_id
       ${where}
       ORDER BY sp.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, size, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM social_posts sp ${where}`,
      params
    );

    // Estatísticas rápidas
    const statsResult = await query(
      `SELECT status, COUNT(*) as count FROM social_posts GROUP BY status`
    );
    const stats: Record<string, number> = {};
    for (const row of statsResult.rows as Array<{ status: string; count: string }>) {
      stats[row.status] = parseInt(row.count);
    }

    return NextResponse.json({
      items: result.rows,
      total: parseInt((countResult.rows[0] as { count: string }).count),
      page,
      size,
      pages: Math.ceil(parseInt((countResult.rows[0] as { count: string }).count) / size),
      stats,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

// POST — disparar fila manualmente ou retentar posts com falha
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { action, post_id } = body as { action: string; post_id?: string };

    if (action === 'process_queue') {
      const result = await processSocialQueue();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'retry' && post_id) {
      await query(
        `UPDATE social_posts
         SET status = 'pending', retry_count = 0, error_message = NULL,
             scheduled_for = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [post_id]
      );
      return NextResponse.json({ ok: true, message: 'Post reagendado para reenvio' });
    }

    if (action === 'skip' && post_id) {
      await query(
        `UPDATE social_posts SET status = 'skipped', updated_at = NOW() WHERE id = $1`,
        [post_id]
      );
      return NextResponse.json({ ok: true, message: 'Post marcado como ignorado' });
    }

    if (action === 'retry_all_failed') {
      const result = await query(
        `UPDATE social_posts
         SET status = 'pending', retry_count = 0, error_message = NULL,
             scheduled_for = NOW(), updated_at = NOW()
         WHERE status = 'failed'
         RETURNING id`
      );
      return NextResponse.json({ ok: true, retried: result.rowCount ?? 0 });
    }

    return NextResponse.json({ detail: 'Ação inválida' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
