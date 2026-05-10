import type { Metadata } from 'next';
import StolenFlowClient from './client';

export const metadata: Metadata = {
  title: 'Foi roubado? — Backfindr',
  description: 'Registre o ocorrido na rede Backfindr. Se o item aparecer, você recebe uma notificação imediata.',
  robots: 'noindex',
};

export default function StolenFlowPage() {
  return <StolenFlowClient />;
}
