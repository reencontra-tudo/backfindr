import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/comunidade/posts — lista posts publicados (público)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');
  const featured = searchParams.get('featured') === 'true';

  try {
    const conditions: string[] = [`status = 'published'`];
    const params: unknown[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      params.push(category);
    }
    if (featured) {
      conditions.push(`featured = true`);
    }

    const where = conditions.join(' AND ');

    const [postsRes, countRes] = await Promise.all([
      query(
        `SELECT id, slug, title, subtitle, category, cover_url, author_name, author_avatar,
                tags, featured, views, likes, published_at, created_at
         FROM community_posts
         WHERE ${where}
         ORDER BY featured DESC, published_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM community_posts WHERE ${where}`,
        params
      ),
    ]);

    return NextResponse.json({
      posts: postsRes.rows,
      total: parseInt(countRes.rows[0]?.total || '0'),
    });
  } catch (err) {
    console.error('[comunidade/posts GET]', err);
    return NextResponse.json({ detail: 'Erro ao buscar posts' }, { status: 500 });
  }
}
