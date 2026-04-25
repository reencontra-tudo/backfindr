import type { Metadata } from 'next';
import ParceiroClient from './client';

export const metadata: Metadata = {
  title: 'Seja um Parceiro — Programa de Parceiros',
  description: 'Torne-se parceiro do Backfindr. Indique clientes, ganhe comissão recorrente e ajude mais pessoas a recuperar objetos perdidos.',
  keywords: ['parceiro', 'afiliado', 'comissão', 'programa de parceiros', 'Backfindr', 'indicação'],
  alternates: { canonical: 'https://www.backfindr.com/parceiro' },
  openGraph: {
    title: 'Programa de Parceiros | Backfindr',
    description: 'Indique clientes, ganhe comissão recorrente. Junte-se ao programa de parceiros.',
    url: 'https://www.backfindr.com/parceiro',
    type: 'website',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Backfindr Parceiros' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Parceiros | Backfindr',
    description: 'Ganhe comissão recorrente indicando o Backfindr.',
    images: ['/icons/og-image.png'],
  },
};

export default function ParceiroPage() {
  return <ParceiroClient />;
}
