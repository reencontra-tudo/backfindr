import type { Metadata } from 'next';
import ScanClient from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

async function getObject(code: string) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/objects/scan/${code}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const obj = await getObject(params.code);

  if (!obj) {
    return {
      title: 'Objeto não encontrado | Backfindr',
      description: 'Este QR Code não corresponde a nenhum objeto registrado no Backfindr.',
      robots: { index: false, follow: false },
    };
  }

  const statusLabel: Record<string, string> = {
    lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
  };
  const categoryEmoji: Record<string, string> = {
    phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
    bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
    electronics: '💻', clothing: '👕', other: '📦',
  };

  const emoji = categoryEmoji[obj.category] ?? '📦';
  const status = statusLabel[obj.status] ?? 'Objeto';
  const locationStr = obj.location?.address ? ` em ${obj.location.address}` : '';
  const description = `${emoji} ${status}: ${obj.title}${locationStr}. Se você encontrou este objeto, clique para notificar o dono de forma anônima.`.slice(0, 160);
  const canonicalUrl = `${APP_URL}/scan/${obj.unique_code}`;
  const ogImage = obj.photos?.[0] ?? '/icons/og-image.png';

  return {
    title: `${emoji} ${obj.title} — ${status} | Backfindr`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${obj.title} — ${status} | Backfindr`,
      description,
      url: canonicalUrl,
      type: 'website',
      images: [{ url: ogImage, width: 800, height: 600, alt: obj.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${obj.title} — ${status}`,
      description,
      images: [ogImage],
    },
    robots: { index: false, follow: false },
  };
}

export default function ScanPage() {
  return <ScanClient />;
}
