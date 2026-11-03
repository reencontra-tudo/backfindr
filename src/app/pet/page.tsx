import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Pet desaparecido — Backfindr',
  description: 'Registre um alerta de pet desaparecido gratuitamente. A rede Backfindr cruza relatos em tempo real.',
  alternates: { canonical: `${APP_URL}/pet` },
  openGraph: {
    title: 'Pet desaparecido — Backfindr',
    description: 'Registre um alerta de pet desaparecido gratuitamente.',
    url: `${APP_URL}/pet`,
  },
};

export default function PetPage() {
  redirect('/flow/pet');
}
