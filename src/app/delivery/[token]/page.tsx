import type { Metadata } from 'next';
import DeliveryTrackClient from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

async function getEntrega(token: string) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/delivery/link/${token}`, {
      cache: 'no-store',
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
  params: { token: string };
}): Promise<Metadata> {
  const e = await getEntrega(params.token);
  if (!e) return { title: 'Entrega não encontrada | Backfindr' };
  return {
    title: `Rastreio — ${e.estabelecimento_nome} | Backfindr Delivery`,
    description: `Acompanhe sua entrega de ${e.estabelecimento_nome} em tempo real.`,
    robots: { index: false, follow: false },
  };
}

export default async function DeliveryTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const entrega = await getEntrega(params.token);
  return <DeliveryTrackClient token={params.token} initialData={entrega} />;
}
