import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/v1/comunidade/posts/[slug]/like — curtir post (público, sem auth)
export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  try {
    const res = await query(
      `UPDATE community_posts SET likes = likes + 1
       WHERE slug = $1 AND status = 'published'
       RETURNING likes`,
      [slug]
    );

    if (!res.rows.length) {
      return NextResponse.json({ detail: 'Post não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ likes: res.rows[0].likes });
  } catch (err) {
    console.error('[comunidade/posts/[slug]/like POST]', err);
    return NextResponse.json({ detail: 'Erro ao curtir post' }, { status: 500 });
  }
}
