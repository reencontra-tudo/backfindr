import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Perdi algo — Backfindr',
  description: 'Registre um objeto perdido gratuitamente em menos de 30 segundos. A rede Backfindr cruza relatos em tempo real.',
  alternates: { canonical: `${APP_URL}/perdi` },
  openGraph: {
    title: 'Perdi algo — Backfindr',
    description: 'Registre um objeto perdido gratuitamente em menos de 30 segundos.',
    url: `${APP_URL}/perdi`,
  },
};

export default function PerdiPage() {
  redirect('/flow/lost');
}
