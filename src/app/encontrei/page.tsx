import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Encontrei algo — Backfindr',
  description: 'Registre um objeto encontrado gratuitamente. A conversa com o dono acontece pelo chat da plataforma.',
  alternates: { canonical: `${APP_URL}/encontrei` },
  openGraph: {
    title: 'Encontrei algo — Backfindr',
    description: 'Registre um objeto encontrado gratuitamente. A conversa com o dono acontece pelo chat da plataforma.',
    url: `${APP_URL}/encontrei`,
  },
};

export default function EncontreiPage() {
  redirect('/flow/found');
}
