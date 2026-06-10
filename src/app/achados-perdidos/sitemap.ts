import type { MetadataRoute } from 'next'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const citiesResult = await query(`SELECT slug, updated_at FROM municipalities`)
  const pagesResult = await query(
    `SELECT lp.category_slug, lp.published_at, m.slug as city_slug
     FROM local_pages lp
     JOIN municipalities m ON m.id = lp.municipality_id
     WHERE lp.status = 'published'`
  )

  const cityPages = citiesResult.rows.map((city: any) => ({
    url: `https://backfindr.com/achados-perdidos/${city.slug}`,
    lastModified: city.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const categoryPages = pagesResult.rows.map((p: any) => ({
    url: `https://backfindr.com/achados-perdidos/${p.city_slug}/${p.category_slug}`,
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
