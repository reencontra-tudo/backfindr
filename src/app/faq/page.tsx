import type { Metadata } from 'next';
import FaqClient from './client';

export const metadata: Metadata = {
  title: 'Perguntas Frequentes — FAQ',
  description: 'Tire suas dúvidas sobre o Backfindr: como registrar objetos perdidos, como funciona o QR Code, matching por IA, planos e muito mais.',
  keywords: ['FAQ', 'perguntas frequentes', 'objeto perdido', 'QR Code', 'como funciona', 'Backfindr'],
  alternates: { canonical: 'https://www.backfindr.com/faq' },
  openGraph: {
    title: 'FAQ — Perguntas Frequentes | Backfindr',
    description: 'Tire suas dúvidas sobre como recuperar objetos perdidos com QR Code e IA.',
    url: 'https://www.backfindr.com/faq',
    type: 'website',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Backfindr FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ | Backfindr',
    description: 'Tire suas dúvidas sobre como recuperar objetos perdidos.',
    images: ['/icons/og-image.png'],
  },
};

export default function FaqPage() {
  return <FaqClient />;
}
