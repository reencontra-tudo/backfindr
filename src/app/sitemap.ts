import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    // ── Core ──────────────────────────────────────────────────────────────────
    { url: BASE_URL,                         lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/map`,                lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/buscar`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE_URL}/achei`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE_URL}/perdi`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/encontrei`,          lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/roubado`,            lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/proteger`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${BASE_URL}/pet`,                lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },

    // ── Fluxos guiados ────────────────────────────────────────────────────────
    { url: `${BASE_URL}/flow/lost`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/flow/found`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/flow/pet`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/flow/protect`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/flow/stolen`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },

    // ── Institucional ─────────────────────────────────────────────────────────
    { url: `${BASE_URL}/pricing`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE_URL}/blog`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.75 },
    { url: `${BASE_URL}/faq`,                lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/parceiro`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/privacy`,            lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },

    // ── Auth ──────────────────────────────────────────────────────────────────
    { url: `${BASE_URL}/auth/login`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/auth/register`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ];

  // ── Objetos públicos dinâmicos ────────────────────────────────────────────
  let objectRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BASE_URL}/api/v1/objects/public?size=1000`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      objectRoutes = (data.items ?? []).map(
        (obj: { unique_code: string; updated_at: string; status: string }) => ({
          url: `${BASE_URL}/objeto/${obj.unique_code}`,
          lastModified: new Date(obj.updated_at),
          changeFrequency: obj.status === 'returned' ? ('yearly' as const) : ('daily' as const),
          priority: obj.status === 'returned' ? 0.5 : 0.8,
        })
      );
    }
  } catch { /* ignore */ }

  // ── Posts do blog dinâmicos ───────────────────────────────────────────────
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${BASE_URL}/api/v1/blog/posts?size=200`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      blogRoutes = (data.items ?? data ?? []).map(
        (post: { slug: string; updated_at?: string; published_at?: string }) => ({
          url: `${BASE_URL}/blog/${post.slug}`,
          lastModified: new Date(post.updated_at ?? post.published_at ?? Date.now()),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })
      );
    }
  } catch { /* ignore */ }

  return [...staticRoutes, ...objectRoutes, ...blogRoutes];
}
