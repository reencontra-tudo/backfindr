import type { Metadata } from 'next';
import PhoneFlowClient from './client';

export const metadata: Metadata = {
  title: 'Perdeu o celular? — Backfindr',
  description: 'Registre seu celular perdido em 30 segundos. Cada hora conta — a rede te avisa se alguém encontrar.',
  robots: 'noindex',
};

export default function PhoneFlowPage() {
  return <PhoneFlowClient />;
}
