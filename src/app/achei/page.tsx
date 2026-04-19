import type { Metadata } from 'next';
import AcheiClient from './client';

export const metadata: Metadata = {
  title: 'Encontrei um objeto — ver se há dono',
  description: 'Encontrou algo perdido? Pesquise na rede do Backfindr se o dono já está procurando e ajude a devolver o objeto.',
  alternates: { canonical: 'https://www.backfindr.com/achei' },
  openGraph: {
    title: 'Encontrei um objeto — ver se há dono | Backfindr',
    description: 'Encontrou algo perdido? Veja se o dono já está procurando na nossa rede.',
    url: 'https://www.backfindr.com/achei',
  },
};

export default function AcheiPage() {
  return <AcheiClient />;
}
