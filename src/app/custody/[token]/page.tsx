import type { Metadata } from 'next';
import CustodyConfirmClient from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

async function getCustodia(token: string) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/custody/link/${token}`, {
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
  const c = await getCustodia(params.token);
  if (!c) return { title: 'Link inválido | Backfindr' };
  return {
    title: `Retirar "${c.descricao}" | Backfindr Custody`,
    description: `${c.remetente_nome} deixou um item para você retirar.`,
    robots: { index: false, follow: false },
  };
}

export default async function CustodyTokenPage({
  params,
}: {
  params: { token: string };
}) {
  const custodia = await getCustodia(params.token);
  return <CustodyConfirmClient token={params.token} initialData={custodia} />;
}
