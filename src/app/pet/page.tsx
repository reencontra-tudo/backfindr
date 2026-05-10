import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pet desaparecido — Backfindr',
  description: 'Registre um alerta de pet desaparecido gratuitamente. A rede Backfindr cruza relatos em tempo real.',
  alternates: { canonical: 'https://www.backfindr.com/pet' },
  openGraph: {
    title: 'Pet desaparecido — Backfindr',
    description: 'Registre um alerta de pet desaparecido gratuitamente.',
    url: 'https://www.backfindr.com/pet',
  },
};

export default function PetPage() {
  redirect('/flow/pet');
}
