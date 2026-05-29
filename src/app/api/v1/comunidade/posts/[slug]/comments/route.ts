import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/v1/comunidade/posts/[slug]/comments — enviar comentário (público, moderação pendente)
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  try {
    const body = await req.json() as { name?: string; body?: string };
    const name = (body.name || '').trim().slice(0, 100);
    const text = (body.body || '').trim().slice(0, 2000);

    if (!name || !text) {
      return NextResponse.json({ detail: 'Nome e comentário são obrigatórios' }, { status: 400 });
    }

    // Verificar se post existe e está publicado
    const postRes = await query(
      `SELECT id FROM community_posts WHERE slug = $1 AND status = 'published'`,
      [slug]
    );

    if (!postRes.rows.length) {
      return NextResponse.json({ detail: 'Post não encontrado' }, { status: 404 });
    }

    const postId = postRes.rows[0].id;

    await query(
      `INSERT INTO community_comments (post_id, name, body, status) VALUES ($1, $2, $3, 'pending')`,
      [postId, name, text]
    );

    return NextResponse.json({ success: true, message: 'Comentário enviado para moderação' });
  } catch (err) {
    console.error('[comunidade/posts/[slug]/comments POST]', err);
    return NextResponse.json({ detail: 'Erro ao enviar comentário' }, { status: 500 });
  }
}
