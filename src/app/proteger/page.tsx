import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Proteger meus objetos — Backfindr',
  description: 'Crie um QR Code gratuito para seus objetos em menos de 1 minuto. Se perdido, o achador te contacta com segurança.',
  alternates: { canonical: `${APP_URL}/proteger` },
  openGraph: {
    title: 'Proteger meus objetos — Backfindr',
    description: 'Crie um QR Code gratuito para seus objetos em menos de 1 minuto.',
    url: `${APP_URL}/proteger`,
  },
};

export default function ProtegerPage() {
  redirect('/flow/protect');
}
