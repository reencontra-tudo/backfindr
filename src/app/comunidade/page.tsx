// src/app/comunidade/page.tsx
// Server Component — SSR para indexação pelo Google
// Faz o fetch inicial no servidor; interatividade fica no ComunidadeClient

import type { Metadata } from 'next';
import ComunidadeClient from './ComunidadeClient';

const BASE = 'https://backfindr.com';

export const metadata: Metadata = {
  title: 'Comunidade Backfindr — Dicas, Casos e Guias sobre Objetos Perdidos',
  description: 'Tudo sobre objetos perdidos em São Paulo e no Brasil. Casos reais de recuperação, guias práticos, dicas de segurança e debates da comunidade Backfindr.',
  keywords: ['objetos perdidos', 'achados e perdidos', 'recuperar objeto', 'São Paulo', 'Backfindr', 'comunidade'],
  openGraph: {
    title: 'Comunidade Backfindr',
    description: 'Dicas, casos reais, guias e ocorrências sobre objetos perdidos no Brasil.',
    url: `${BASE}/comunidade`,
    siteName: 'Backfindr',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comunidade Backfindr',
    description: 'Casos reais, dicas e guias sobre objetos perdidos no Brasil.',
  },
  alternates: { canonical: `${BASE}/comunidade` },
};

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  category: string;
  cover_url?: string;
  author_name: string;
  tags: string[];
  featured: boolean;
  views: number;
  likes: number;
  published_at: string;
}

// Fetch SSR — Google indexa o conteúdo dos cards diretamente
async function fetchInitialPosts(): Promise<{ posts: Post[]; total: number }> {
  try {
    const res = await fetch(`${BASE}/api/v1/comunidade/posts?limit=12`, {
      next: { revalidate: 300 }, // revalida a cada 5min
    });
    if (!res.ok) return { posts: [], total: 0 };
    return res.json();
  } catch {
    return { posts: [], total: 0 };
  }
}

export default async function ComunidadePage() {
  const { posts, total } = await fetchInitialPosts();

  // Schema.org BreadcrumbList para o Google
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Comunidade Backfindr',
    description: 'Dicas, casos reais, guias e ocorrências sobre objetos perdidos no Brasil.',
    url: `${BASE}/comunidade`,
    publisher: {
      '@type': 'Organization',
      name: 'Backfindr',
      url: BASE,
      logo: { '@type': 'ImageObject', url: `${BASE}/icons/logo-backfindr-white.png` },
    },
    // Artigos indexados diretamente pelo Google
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.slice(0, 10).map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${BASE}/comunidade/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ComunidadeClient initialPosts={posts} initialTotal={total} />
    </>
  );
}
