import type { Metadata } from 'next';
import BikeFlowClient from './client';

export const metadata: Metadata = {
  title: 'Bike roubada ou perdida? — Backfindr',
  description: 'Registre sua bicicleta em 30 segundos. A rede Backfindr avisa se ela aparecer em SP.',
  robots: 'noindex',
};

export default function BikeFlowPage() {
  return <BikeFlowClient />;
}
