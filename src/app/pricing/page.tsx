import type { Metadata } from 'next';
import PricingClient from './client';

export const metadata: Metadata = {
  title: 'Planos e Preços — Escolha o seu',
  description: 'Compare os planos do Backfindr: Free, Pro e Business. QR Code permanente, matching por IA e chat mediado para recuperar objetos perdidos.',
  keywords: ['planos', 'preços', 'assinatura', 'QR Code', 'objeto perdido', 'Backfindr Pro', 'Backfindr Business'],
  alternates: { canonical: 'https://www.backfindr.com/pricing' },
  openGraph: {
    title: 'Planos e Preços | Backfindr',
    description: 'Free, Pro e Business. Comece grátis e faça upgrade quando precisar.',
    url: 'https://www.backfindr.com/pricing',
    type: 'website',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Backfindr Planos' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Planos | Backfindr',
    description: 'Escolha o plano ideal para recuperar seus objetos perdidos.',
    images: ['/icons/og-image.png'],
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
