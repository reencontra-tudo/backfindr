import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CondominioJoinClient from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

async function getCondominio(slug: string) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/portaria/condominios/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const cond = await getCondominio(params.slug);
  if (!cond) return { title: 'Condomínio não encontrado | Backfindr' };

  return {
    title: `${cond.nome} — Cadastro de Moradores | Backfindr`,
    description: `Cadastre-se para receber alertas de encomendas e participar da rede de achados e perdidos do ${cond.nome}.`,
    robots: { index: false, follow: false },
  };
}

export default async function CondominioJoinPage({
  params,
}: {
  params: { slug: string };
}) {
  const cond = await getCondominio(params.slug);
  if (!cond) notFound();

  return <CondominioJoinClient condominio={cond} />;
}
