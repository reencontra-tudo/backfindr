import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Item roubado — Backfindr',
  description: 'Registre um alerta de roubo ou furto gratuitamente. A rede Backfindr gera alertas em tempo real na sua região.',
  alternates: { canonical: '/roubado' },
  openGraph: {
    title: 'Item roubado — Backfindr',
    description: 'Registre um alerta de roubo ou furto gratuitamente.',
    url: '/roubado',
  },
};

export default function RoubadoPage() {
  redirect('/flow/stolen');
}
