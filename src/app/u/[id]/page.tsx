import type { Metadata } from 'next';
import UserProfileClient from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

async function getUser(id: string) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/users/public/${id}`, {
      next: { revalidate: 300 },
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
  params: { id: string };
}): Promise<Metadata> {
  const user = await getUser(params.id);

  if (!user) {
    return {
      title: 'Perfil não encontrado | Backfindr',
      robots: { index: false, follow: false },
    };
  }

  const name = user.name ?? 'Usuário';
  const description = `Perfil de ${name} no Backfindr. Veja os objetos perdidos e encontrados registrados por este usuário.`;
  const canonicalUrl = `${APP_URL}/u/${params.id}`;

  return {
    title: `${name} | Backfindr`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${name} | Backfindr`,
      description,
      url: canonicalUrl,
      type: 'profile',
      images: user.avatar_url
        ? [{ url: user.avatar_url, width: 400, height: 400, alt: name }]
        : [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Backfindr' }],
    },
    twitter: {
      card: 'summary',
      title: `${name} | Backfindr`,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default function UserProfilePage() {
  return <UserProfileClient />;
}
