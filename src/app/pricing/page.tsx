import type { Metadata } from 'next';
import PricingClient from './client';
import { APP_URL } from '@/lib/constants';
import { modoCrescimento } from '@/lib/modoCrescimento';

const metadataOriginal: Metadata = {
  title: 'Planos e Preços — Escolha o seu',
  description: 'Compare os planos do Backfindr: Free, Pro e Business. QR Code permanente, matching por IA e chat mediado para recuperar objetos perdidos.',
  keywords: ['planos', 'preços', 'assinatura', 'QR Code', 'objeto perdido', 'Backfindr Pro', 'Backfindr Business'],
  alternates: { canonical: `${APP_URL}/pricing` },
  openGraph: {
    title: 'Planos e Preços | Backfindr',
    description: 'Free, Pro e Business. Comece grátis e faça upgrade quando precisar.',
    url: `${APP_URL}/pricing`,
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

// Modo crescimento (PL-01): sem Pro/Business nos textos de busca e compartilhamento. Desligado = metadados originais acima, sem mudança.
const metadataCrescimento: Metadata = {
  ...metadataOriginal,
  title: 'Backfindr grátis — Cadastre seus objetos',
  description: 'Cadastre quantos objetos precisar, sem custo: QR Code permanente e busca na rede para recuperar objetos perdidos.',
  keywords: ['QR Code', 'objeto perdido', 'Backfindr', 'grátis'],
  openGraph: { ...metadataOriginal.openGraph, title: 'Backfindr grátis', description: 'Comece grátis e cadastre quantos objetos precisar.' },
  twitter: { ...metadataOriginal.twitter, title: 'Backfindr grátis', description: 'Cadastre quantos objetos precisar e recupere o que perdeu.' },
};

export function generateMetadata(): Metadata {
  return modoCrescimento() ? metadataCrescimento : metadataOriginal;
}

export default function PricingPage() {
  return <PricingClient />;
}
