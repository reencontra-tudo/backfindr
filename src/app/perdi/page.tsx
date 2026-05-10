import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Perdi algo — Backfindr',
  description: 'Registre um objeto perdido gratuitamente em menos de 30 segundos. A rede Backfindr cruza relatos em tempo real.',
  alternates: { canonical: 'https://www.backfindr.com/perdi' },
  openGraph: {
    title: 'Perdi algo — Backfindr',
    description: 'Registre um objeto perdido gratuitamente em menos de 30 segundos.',
    url: 'https://www.backfindr.com/perdi',
  },
};

export default function PerdiPage() {
  redirect('/flow/lost');
}
