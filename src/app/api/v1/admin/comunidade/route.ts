import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/comunidade — listar todos os posts (admin)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [postsRes, countRes, pendingRes] = await Promise.all([
      query(
        `SELECT id, slug, title, category, status, featured, views, likes,
                published_at, created_at, updated_at,
                (SELECT COUNT(*) FROM community_comments WHERE post_id = community_posts.id AND status = 'pending') as pending_comments
         FROM community_posts
         ${where}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) as total FROM community_posts ${where}`, params),
      query(`SELECT COUNT(*) as total FROM community_comments WHERE status = 'pending'`),
    ]);

    return NextResponse.json({
      posts: postsRes.rows,
      total: parseInt(countRes.rows[0]?.total || '0'),
      pending_comments: parseInt(pendingRes.rows[0]?.total || '0'),
    });
  } catch (err) {
    console.error('[admin/comunidade GET]', err);
    return NextResponse.json({ detail: 'Erro ao buscar posts' }, { status: 500 });
  }
}

// POST /api/v1/admin/comunidade — criar novo post
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json() as {
      slug?: string;
      title?: string;
      subtitle?: string;
      body?: string;
      category?: string;
      cover_url?: string;
      video_url?: string;
      author_name?: string;
      author_avatar?: string;
      tags?: string[];
      status?: string;
      featured?: boolean;
      seo_title?: string;
      seo_desc?: string;
      debate_question?: string;
    };

    const { slug, title, body: postBody, category = 'dica' } = body;

    if (!slug || !title || !postBody) {
      return NextResponse.json({ detail: 'slug, title e body são obrigatórios' }, { status: 400 });
    }

    // Normalizar slug: lowercase, sem espaços, apenas letras/números/hífens
    const normalizedSlug = slug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const publishedAt = body.status === 'published' ? new Date().toISOString() : null;

    const res = await query(
      `INSERT INTO community_posts
         (slug, title, subtitle, body, category, cover_url, video_url, author_name, author_avatar,
          tags, status, featured, seo_title, seo_desc, debate_question, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        normalizedSlug,
        title,
        body.subtitle || null,
        postBody,
        category,
        body.cover_url || null,
        body.video_url || null,
        body.author_name || 'Equipe Backfindr',
        body.author_avatar || null,
        body.tags || [],
        body.status || 'draft',
        body.featured || false,
        body.seo_title || null,
        body.seo_desc || null,
        body.debate_question || null,
        publishedAt,
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ detail: 'Slug já existe. Use um slug diferente.' }, { status: 409 });
    }
    console.error('[admin/comunidade POST]', err);
    return NextResponse.json({ detail: 'Erro ao criar post' }, { status: 500 });
  }
}
