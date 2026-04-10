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

  return {
    title: `${obj.title} — ${statusLabel[obj.status] ?? 'Objeto'} | Backfindr`,
    description: obj.description?.slice(0, 160),
    openGraph: {
      title: `${obj.title} | Backfindr`,
      description: obj.description?.slice(0, 160),
      images: obj.photos?.[0] ? [obj.photos[0]] : ['/icons/og-image.png'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${obj.title} | Backfindr`,
      description: obj.description?.slice(0, 160),
    },
  };
}

export default async function PublicObjectPage({ params }: { params: { code: string } }) {
  const obj = await getObject(params.code);
  if (!obj) notFound();
  return <PublicObjectClient obj={obj} />;
}
