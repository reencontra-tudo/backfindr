// src/app/sitemap.ts
// Sitemap dinâmico — gerado a partir do banco em cada build/revalidação
// Cobre: páginas estáticas + objetos públicos + posts da comunidade

import type { MetadataRoute } from 'next';

const BASE = 'https://backfindr.com';

// Páginas estáticas com prioridade configurada
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE,                  lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
  { url: `${BASE}/map`,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
  { url: `${BASE}/comunidade`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
  { url: `${BASE}/buscar`,      lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.8 },
  { url: `${BASE}/pet`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
  { url: `${BASE}/pricing`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/perdi`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/achei`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
  { url: `${BASE}/b2b/cadastro`,lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/faq`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/privacy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  { url: `${BASE}/terms`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Posts da comunidade — alta prioridade para SEO de conteúdo
  let communityUrls: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BASE}/api/v1/comunidade/posts?limit=200`, {
      next: { revalidate: 3600 }, // revalida a cada 1h
    });
    if (res.ok) {
      const data = await res.json() as { posts: Array<{ slug: string; published_at: string; category: string }> };
      communityUrls = data.posts.map(post => ({
        url: `${BASE}/comunidade/${post.slug}`,
        lastModified: new Date(post.published_at),
        changeFrequency: 'weekly' as const,
        priority: post.category === 'guia' ? 0.9 : 0.8, // guias têm prioridade máxima
      }));
    }
  } catch {
    // falha silenciosa — sitemap ainda retorna páginas estáticas
  }

  // Objetos públicos — SEO de cauda longa por tipo/localização
  let objectUrls: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BASE}/api/v1/objects/public?limit=500`, {
      next: { revalidate: 1800 }, // revalida a cada 30min
    });
    if (res.ok) {
      const data = await res.json() as { items: Array<{ qr_code: string; updated_at?: string; created_at: string }> };
      objectUrls = (data.items || []).map(obj => ({
        url: `${BASE}/objeto/${obj.qr_code}`,
        lastModified: new Date(obj.updated_at || obj.created_at),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // falha silenciosa
  }

  return [...STATIC_PAGES, ...communityUrls, ...objectUrls];
}
