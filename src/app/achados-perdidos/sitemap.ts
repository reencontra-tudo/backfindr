import type { MetadataRoute } from 'next'

const SUPA = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
  }
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url, headers } = SUPA()

  const [citiesRes, pagesRes] = await Promise.all([
    fetch(`${url}/rest/v1/municipalities?select=slug,updated_at`, { headers, next: { revalidate: 3600 } }),
    fetch(`${url}/rest/v1/local_pages?status=eq.published&select=category_slug,published_at,municipality_id`, { headers, next: { revalidate: 3600 } }),
  ])

  const cities = citiesRes.ok ? await citiesRes.json() : []
  const pagesRaw = pagesRes.ok ? await pagesRes.json() : []

  const slugMap: Record<number, string> = {}
  cities.forEach((c: any) => { slugMap[c.id] = c.slug })

  const cityPages = cities.map((city: any) => ({
    url: `https://backfindr.com/achados-perdidos/${city.slug}`,
    lastModified: city.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const categoryPages = pagesRaw
    .filter((p: any) => slugMap[p.municipality_id])
    .map((p: any) => ({
      url: `https://backfindr.com/achados-perdidos/${slugMap[p.municipality_id]}/${p.category_slug}`,
      lastModified: p.published_at,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  return [
    { url: 'https://backfindr.com/achados-perdidos', changeFrequency: 'daily', priority: 0.9 },
    ...cityPages,
    ...categoryPages,
  ]
}
