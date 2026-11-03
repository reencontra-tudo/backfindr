import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Item roubado — Backfindr',
  description: 'Registre um alerta de roubo ou furto gratuitamente. A rede Backfindr gera alertas em tempo real na sua região.',
  alternates: { canonical: `${APP_URL}/roubado` },
  openGraph: {
    title: 'Item roubado — Backfindr',
    description: 'Registre um alerta de roubo ou furto gratuitamente.',
    url: `${APP_URL}/roubado`,
  },
};

export default function RoubadoPage() {
  redirect('/flow/stolen');
}
