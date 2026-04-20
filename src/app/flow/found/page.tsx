import type { Metadata } from 'next';
import FoundFlowClient from './client';

export const metadata: Metadata = {
  title: 'Encontrou algo? — Backfindr',
  description: 'Publique o achado em menos de 30 segundos. O dono recebe uma notificação e entra em contato com segurança.',
  robots: 'noindex',
};

export default function FoundFlowPage() {
  return <FoundFlowClient />;
}
