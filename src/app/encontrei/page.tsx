import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encontrei algo — Backfindr',
  description: 'Registre um objeto encontrado gratuitamente. Seu contato fica protegido e o dono pode te encontrar.',
  alternates: { canonical: '/encontrei' },
  openGraph: {
    title: 'Encontrei algo — Backfindr',
    description: 'Registre um objeto encontrado gratuitamente. Seu contato fica protegido.',
    url: '/encontrei',
  },
};

export default function EncontreiPage() {
  redirect('/flow/found');
}
