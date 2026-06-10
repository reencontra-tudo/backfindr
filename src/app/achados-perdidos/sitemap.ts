import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  const { data: pages } = await supabase
    .from('local_pages')
    .select('category_slug, published_at, municipalities(slug)')
    .eq('status', 'published')

  const { data: cities } = await supabase
    .from('municipalities')
    .select('slug, updated_at')

  const cityPages = cities?.map(city => ({
    url: `https://backfindr.com/achados-perdidos/${city.slug}`,
    lastModified: city.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  })) ?? []

  const categoryPages = pages?.map((page: any) => ({
    url: `https://backfindr.com/achados-perdidos/${page.municipalities.slug}/${page.category_slug}`,
    lastModified: page.published_at,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  })) ?? []

  return [
    {
      url: 'https://backfindr.com/achados-perdidos',
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...cityPages,
    ...categoryPages,
  ]
}
