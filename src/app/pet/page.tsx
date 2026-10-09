import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pet desaparecido — Backfindr',
  description: 'Registre um alerta de pet desaparecido gratuitamente. A rede Backfindr cruza relatos em tempo real.',
  alternates: { canonical: '/pet' },
  openGraph: {
    title: 'Pet desaparecido — Backfindr',
    description: 'Registre um alerta de pet desaparecido gratuitamente.',
    url: '/pet',
  },
};

export default function PetPage() {
  redirect('/flow/pet');
}
