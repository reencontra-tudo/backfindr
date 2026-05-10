import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Proteger meus objetos — Backfindr',
  description: 'Crie um QR Code gratuito para seus objetos em menos de 1 minuto. Se perdido, o achador te contacta com segurança.',
  alternates: { canonical: 'https://www.backfindr.com/proteger' },
  openGraph: {
    title: 'Proteger meus objetos — Backfindr',
    description: 'Crie um QR Code gratuito para seus objetos em menos de 1 minuto.',
    url: 'https://www.backfindr.com/proteger',
  },
};

export default function ProtegerPage() {
  redirect('/flow/protect');
}
