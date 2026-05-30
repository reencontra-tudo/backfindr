import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PostClient from './PostClient';

const BASE_URL = 'https://backfindr.com';

// ─── Metadados dinâmicos para SEO ─────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/comunidade/posts/${params.slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Comunidade — Backfindr' };

    const data = await res.json() as { post: {
      title: string; subtitle?: string; seo_title?: string; seo_desc?: string;
      cover_url?: string; author_name: string; published_at: string; tags: string[];
    }};
    const { post } = data;

    const title = post.seo_title || post.title;
    const description = post.seo_desc || post.subtitle || `${post.title} — Comunidade Backfindr`;
    const url = `${BASE_URL}/comunidade/${params.slug}`;

    return {
      title: `${title} — Comunidade Backfindr`,
      description,
      keywords: [...(post.tags || []), 'objetos perdidos', 'Backfindr', 'comunidade'].join(', '),
      authors: [{ name: post.author_name }],
      openGraph: {
        title,
        description,
        url,
        siteName: 'Backfindr',
        type: 'article',
        publishedTime: post.published_at,
        authors: [post.author_name],
        images: post.cover_url ? [{ url: post.cover_url, width: 1200, height: 630 }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: post.cover_url ? [post.cover_url] : [],
      },
      alternates: { canonical: url },
    };
  } catch {
    return { title: 'Comunidade — Backfindr' };
  }
}

import { cookies } from 'next/headers';

// ─── Página (Server Component) ────────────────────────────────────────────────
export default async function ComunidadePostPage(
  { params }: { params: { slug: string } }
) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    const res = await fetch(`${BASE_URL}/api/v1/comunidade/posts/${params.slug}`, {
      next: { revalidate: 0 }, // sem cache para rascunhos
      headers: accessToken ? { Cookie: `access_token=${accessToken}` } : {},
    });
    if (!res.ok) notFound();

    const data = await res.json() as {
      post: Record<string, unknown>;
      comments: Record<string, unknown>[];
      related: Record<string, unknown>[];
    };

    // Schema.org Article para Google e IA Search
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.post.title,
      description: data.post.seo_desc || data.post.subtitle,
      image: data.post.cover_url,
      author: { '@type': 'Organization', name: data.post.author_name },
      publisher: {
        '@type': 'Organization',
        name: 'Backfindr',
        logo: { '@type': 'ImageObject', url: `${BASE_URL}/icons/logo-backfindr-white.png` },
      },
      datePublished: data.post.published_at,
      dateModified: data.post.updated_at || data.post.published_at,
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
          initialPost={data.post}
          initialComments={data.comments}
          related={data.related}
          slug={params.slug}
        />
      </>
    );
  } catch {
    notFound();
  }
}
