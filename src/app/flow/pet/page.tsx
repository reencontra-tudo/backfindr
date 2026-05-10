import type { Metadata } from 'next';
import PetFlowClient from './client';

export const metadata: Metadata = {
  title: 'Meu pet sumiu — Backfindr',
  description: 'Publique um alerta de pet desaparecido em segundos. A rede Backfindr cruza relatos de animais encontrados em tempo real.',
  robots: 'noindex',
};

export default function PetFlowPage() {
  return <PetFlowClient />;
}
