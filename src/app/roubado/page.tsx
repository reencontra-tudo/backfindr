import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Item roubado — Backfindr',
  description: 'Registre um alerta de roubo ou furto gratuitamente. A rede Backfindr gera alertas em tempo real na sua região.',
  alternates: { canonical: 'https://www.backfindr.com/roubado' },
  openGraph: {
    title: 'Item roubado — Backfindr',
    description: 'Registre um alerta de roubo ou furto gratuitamente.',
    url: 'https://www.backfindr.com/roubado',
  },
};

export default function RoubadoPage() {
  redirect('/flow/stolen');
}
