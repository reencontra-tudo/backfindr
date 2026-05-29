import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/comunidade/posts/[slug] — post individual + comentários aprovados
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  try {
    const postRes = await query(
      `SELECT id, slug, title, subtitle, body, category, cover_url,
              author_name, author_avatar, tags, featured, views, likes,
              seo_title, seo_desc, published_at, created_at
       FROM community_posts
       WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (!postRes.rows.length) {
      return NextResponse.json({ detail: 'Post não encontrado' }, { status: 404 });
    }

    const post = postRes.rows[0];

    // Incrementar views de forma assíncrona (não bloqueia resposta)
    query(
      `UPDATE community_posts SET views = views + 1 WHERE id = $1`,
      [post.id]
    ).catch(() => {});

    // Buscar comentários aprovados
    const commentsRes = await query(
      `SELECT id, name, body, created_at
       FROM community_comments
       WHERE post_id = $1 AND status = 'approved'
       ORDER BY created_at ASC`,
      [post.id]
    );

    // Posts relacionados (mesma categoria, exceto o atual)
    const relatedRes = await query(
      `SELECT id, slug, title, subtitle, category, cover_url, author_name, published_at, views, likes
       FROM community_posts
       WHERE category = $1 AND slug != $2 AND status = 'published'
       ORDER BY published_at DESC
       LIMIT 3`,
      [post.category, slug]
    );

    return NextResponse.json({
      post,
      comments: commentsRes.rows,
      related: relatedRes.rows,
    });
  } catch (err) {
    console.error('[comunidade/posts/[slug] GET]', err);
    return NextResponse.json({ detail: 'Erro ao buscar post' }, { status: 500 });
  }
}
