import type { Metadata } from 'next';
import BuscarClient from './client';

export const metadata: Metadata = {
  title: 'Buscar objetos perdidos',
  description: 'Pesquise na rede do Backfindr se alguém já encontrou o que você perdeu. Carteiras, celulares, pets, documentos e muito mais.',
  alternates: { canonical: 'https://www.backfindr.com/buscar' },
  openGraph: {
    title: 'Buscar objetos perdidos | Backfindr',
    description: 'Pesquise na rede se alguém já encontrou o que você perdeu.',
    url: 'https://www.backfindr.com/buscar',
  },
};

export default function BuscarPage() {
  return <BuscarClient />;
}
