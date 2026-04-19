import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicObjectClient from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getObject(code: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/objects/scan/${code}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const obj = await getObject(params.code);
  if (!obj) return { title: 'Objeto não encontrado | Backfindr' };

  const statusLabel: Record<string, string> = {
    lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
  };

  const locationStr = obj.location?.address ? ` — ${obj.location.address}` : '';
  const descriptionFull = `${statusLabel[obj.status] ?? 'Objeto'}: ${obj.title}${locationStr}. ${obj.description ?? ''}`.slice(0, 160);
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br'}/objeto/${obj.unique_code}`;

  return {
    title: `${obj.title} — ${statusLabel[obj.status] ?? 'Objeto'} | Backfindr`,
    description: descriptionFull,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${obj.title} | Backfindr`,
      description: descriptionFull,
      url: canonicalUrl,
      images: obj.photos?.[0] ? [{ url: obj.photos[0], alt: obj.title }] : ['/icons/og-image.png'],
      type: 'website',
      locale: 'pt_BR',
      siteName: 'Backfindr',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${obj.title} | Backfindr`,
      description: descriptionFull,
      images: obj.photos?.[0] ? [obj.photos[0]] : ['/icons/og-image.png'],
    },
  };
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com.br';

function buildJsonLd(obj: Record<string, unknown>) {
  const statusLabel: Record<string, string> = {
    lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
  };
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: obj.title,
    description: obj.description,
    url: `${BASE_URL}/objeto/${obj.unique_code}`,
    identifier: obj.unique_code,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'status', value: statusLabel[obj.status as string] ?? obj.status },
      { '@type': 'PropertyValue', name: 'category', value: obj.category },
    ],
  };
  if ((obj.photos as string[])?.length) {
    base.image = (obj.photos as string[])[0];
  }
  if (obj.location && typeof obj.location === 'object') {
    const loc = obj.location as { lat?: number; lng?: number; address?: string };
    if (loc.lat && loc.lng) {
      base.locationCreated = {
        '@type': 'Place',
        name: loc.address ?? 'Brasil',
        geo: { '@type': 'GeoCoordinates', latitude: loc.lat, longitude: loc.lng },
      };
    }
  }
  if (obj.created_at) base.dateCreated = obj.created_at;
  if (obj.updated_at) base.dateModified = obj.updated_at;
  return base;
}

export default async function PublicObjectPage({ params }: { params: { code: string } }) {
  const obj = await getObject(params.code);
  if (!obj) notFound();
  const jsonLd = buildJsonLd(obj);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicObjectClient obj={obj} />
    </>
  );
}
