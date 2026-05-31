import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import PostClient from './PostClient';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

const BASE_URL = 'https://backfindr.com';

// Verifica se o request vem de um admin
async function checkIsAdmin(): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('access_token')?.value;
    if (!token) return false;
    const payload = verifyToken(token);
    if (!payload?.sub) return false;
    const res = await query(`SELECT role FROM users WHERE id = $1`, [payload.sub]);
    const role = res.rows[0]?.role;
    return role === 'super_admin' || role === 'admin';
  } catch { return false; }
}

// Busca post do banco diretamente (Server Component — sem fetch externo)
async function getPost(slug: string, isAdmin: boolean) {
  const statusFilter = isAdmin ? '' : `AND status = 'published'`;
  const postRes = await query(
    `SELECT id, slug, title, subtitle, body, category, cover_url, video_url,
            author_name, author_avatar, tags, featured, views, likes, status,
            seo_title, seo_desc, published_at, created_at, debate_question
     FROM community_posts
     WHERE slug = $1 ${statusFilter}`,
    [slug]
  );
  if (!postRes.rows.length) return null;
  const post = postRes.rows[0];

  // Incrementar views (apenas para posts publicados)
  if (post.status === 'published') {
    query(`UPDATE community_posts SET views = views + 1 WHERE id = $1`, [post.id]).catch(() => {});
  }

  const commentsRes = await query(
    `SELECT id, name, body, created_at, featured FROM community_comments
     WHERE post_id = $1 AND status = 'approved' ORDER BY created_at ASC`,
    [post.id]
  );

  const relatedRes = await query(
    `SELECT id, slug, title, subtitle, category, cover_url, author_name, published_at, views, likes
     FROM community_posts
     WHERE category = $1 AND slug != $2 AND status = 'published'
     ORDER BY published_at DESC LIMIT 3`,
    [post.category, slug]
  );

  return { post, comments: commentsRes.rows, related: relatedRes.rows };
}

// ─── Metadados dinâmicos para SEO ─────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  try {
    const isAdmin = await checkIsAdmin();
    const data = await getPost(params.slug, isAdmin);
    if (!data) return { title: 'Comunidade — Backfindr' };
    const { post } = data as { post: Record<string, unknown> };

    const title = String(post.seo_title || post.title || '');
    const description = String(post.seo_desc || post.subtitle || `${post.title} — Comunidade Backfindr`);
    const url = `${BASE_URL}/comunidade/${params.slug}`;
    const coverUrl = post.cover_url as string | undefined;
    const tags = (post.tags as string[]) || [];

    return {
      title: `${title} — Comunidade Backfindr`,
      description,
      keywords: [...tags, 'objetos perdidos', 'Backfindr', 'comunidade'].join(', '),
      authors: [{ name: String(post.author_name || '') }],
      openGraph: {
        title, description, url, siteName: 'Backfindr', type: 'article',
        publishedTime: String(post.published_at || ''),
        authors: [String(post.author_name || '')],
        images: coverUrl ? [{ url: coverUrl, width: 1200, height: 630 }] : [],
      },
      twitter: {
        card: 'summary_large_image', title, description,
        images: coverUrl ? [coverUrl] : [],
      },
      alternates: { canonical: url },
    };
  } catch {
    return { title: 'Comunidade — Backfindr' };
  }
}

// ─── Página (Server Component) ────────────────────────────────────────────────
export default async function ComunidadePostPage(
  { params }: { params: { slug: string } }
) {
  try {
    const isAdmin = await checkIsAdmin();
    const data = await getPost(params.slug, isAdmin);
    if (!data) notFound();

    const { post, comments, related } = data!;

    // Schema.org Article para Google e IA Search
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.seo_desc || post.subtitle,
      image: post.cover_url,
      author: { '@type': 'Organization', name: post.author_name },
      publisher: {
        '@type': 'Organization',
        name: 'Backfindr',
        logo: { '@type': 'ImageObject', url: `${BASE_URL}/icons/logo-backfindr-white.png` },
      },
      datePublished: post.published_at,
      dateModified: post.updated_at || post.published_at,
      url: `${BASE_URL}/comunidade/${params.slug}`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/comunidade/${params.slug}` },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
        <PostClient
          initialPost={post}
          initialComments={comments}
          related={related}
          slug={params.slug}
        />
      </>
    );
  } catch {
    notFound();
  }
}
