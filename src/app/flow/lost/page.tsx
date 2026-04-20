import type { Metadata } from 'next';
import LostFlowClient from './client';

export const metadata: Metadata = {
  title: 'Perdeu algo? — Backfindr',
  description: 'Publique um alerta em menos de 30 segundos. A rede Backfindr cruza relatos de perda e achado em tempo real.',
  robots: 'noindex',
};

export default function LostFlowPage() {
  return <LostFlowClient />;
}
