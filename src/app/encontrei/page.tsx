import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encontrei algo — Backfindr',
  description: 'Registre um objeto encontrado gratuitamente. Seu contato fica protegido e o dono pode te encontrar.',
  alternates: { canonical: 'https://www.backfindr.com/encontrei' },
  openGraph: {
    title: 'Encontrei algo — Backfindr',
    description: 'Registre um objeto encontrado gratuitamente. Seu contato fica protegido.',
    url: 'https://www.backfindr.com/encontrei',
  },
};

export default function EncontreiPage() {
  redirect('/flow/found');
}
