import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/comunidade/[id] — buscar post completo
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const postRes = await query(
      `SELECT * FROM community_posts WHERE id = $1`,
      [params.id]
    );

    if (!postRes.rows.length) {
      return NextResponse.json({ detail: 'Post não encontrado' }, { status: 404 });
    }

    const commentsRes = await query(
      `SELECT * FROM community_comments WHERE post_id = $1 ORDER BY created_at DESC`,
      [params.id]
    );

    return NextResponse.json({ post: postRes.rows[0], comments: commentsRes.rows });
  } catch (err) {
    console.error('[admin/comunidade/[id] GET]', err);
    return NextResponse.json({ detail: 'Erro ao buscar post' }, { status: 500 });
  }
}

// PATCH /api/v1/admin/comunidade/[id] — atualizar post
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = [
      'slug', 'title', 'subtitle', 'body', 'category', 'cover_url', 'video_url',
      'author_name', 'author_avatar', 'tags', 'status', 'featured',
      'seo_title', 'seo_desc', 'debate_question',
    ];

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    // Gerenciar published_at automaticamente
    if ('status' in body) {
      if (body.status === 'published') {
        // Só define published_at se ainda não tiver
        const existing = await query(
          `SELECT published_at FROM community_posts WHERE id = $1`,
          [params.id]
        );
        if (!existing.rows[0]?.published_at) {
          sets.push(`published_at = $${idx++}`);
          values.push(new Date().toISOString());
        }
      } else if (body.status === 'draft') {
        sets.push(`published_at = $${idx++}`);
        values.push(null);
      }
    }

    if (!sets.length) {
      return NextResponse.json({ detail: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(params.id);

    const res = await query(
      `UPDATE community_posts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!res.rows.length) {
      return NextResponse.json({ detail: 'Post não encontrado' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err) {
    console.error('[admin/comunidade/[id] PATCH]', err);
    return NextResponse.json({ detail: 'Erro ao atualizar post' }, { status: 500 });
  }
}

// DELETE /api/v1/admin/comunidade/[id] — excluir post
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await query(`DELETE FROM community_posts WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/comunidade/[id] DELETE]', err);
    return NextResponse.json({ detail: 'Erro ao excluir post' }, { status: 500 });
  }
}
