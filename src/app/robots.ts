import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Crawlers gerais
        userAgent: '*',
        allow: [
          '/',
          '/map',
          '/buscar',
          '/achei',
          '/perdi',
          '/encontrei',
          '/roubado',
          '/proteger',
          '/pet',
          '/flow/',
          '/objeto/',
          '/blog/',
          '/pricing',
          '/faq',
          '/parceiro',
          '/terms',
          '/privacy',
          '/auth/login',
          '/auth/register',
        ],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/scan/',
          '/u/',
          '/checkout/',
        ],
      },
      {
        // Bloquear GPTBot e outros scrapers de IA
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
      {
        userAgent: 'anthropic-ai',
        disallow: ['/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
