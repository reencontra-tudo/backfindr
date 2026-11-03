import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encontrei algo — Backfindr',
  description: 'Registre um objeto encontrado gratuitamente. A conversa com o dono acontece pelo chat da plataforma.',
  alternates: { canonical: 'https://www.backfindr.com/encontrei' },
  openGraph: {
    title: 'Encontrei algo — Backfindr',
    description: 'Registre um objeto encontrado gratuitamente. A conversa com o dono acontece pelo chat da plataforma.',
    url: 'https://www.backfindr.com/encontrei',
  },
};

export default function EncontreiPage() {
  redirect('/flow/found');
}
