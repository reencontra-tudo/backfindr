import type { Metadata } from 'next';
import FaqClient from './client';

export const metadata: Metadata = {
  title: 'Perguntas Frequentes — FAQ',
  description: 'Tire suas dúvidas sobre o Backfindr: como cadastrar o que perdeu, achou ou foi roubado, como funcionam as correspondências, planos e muito mais.',
  keywords: ['FAQ', 'perguntas frequentes', 'objeto perdido', 'como funciona', 'Backfindr'],
  alternates: { canonical: 'https://www.backfindr.com/faq' },
  openGraph: {
    title: 'FAQ — Perguntas Frequentes | Backfindr',
    description: 'Tire suas dúvidas sobre como cadastrar e pesquisar o que foi perdido, roubado ou achado.',
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
