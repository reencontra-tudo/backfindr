import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br';
const API_URL  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:8000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL,                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/map`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/buscar`,          lastModified: new Date(), changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE_URL}/achei`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.95 },
    { url: `${BASE_URL}/auth/login`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/auth/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/pricing`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/blog`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/faq`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/terms`,         lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/privacy`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];

  // Dynamic: public objects pages
  let objectRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/v1/objects/public?size=500`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      objectRoutes = (data.items ?? []).map((obj: { unique_code: string; updated_at: string }) => ({
        url: `${BASE_URL}/objeto/${obj.unique_code}`,
        lastModified: new Date(obj.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }));
    }
  } catch { /* ignore */ }

  return [...staticRoutes, ...objectRoutes];
}
