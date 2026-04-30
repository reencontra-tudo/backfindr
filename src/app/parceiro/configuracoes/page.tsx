import type { Metadata } from 'next';
import ParceiroConfiguracoesClient from './client';

export const metadata: Metadata = {
  title: 'Configurações — Portal Parceiro Backfindr',
  robots: 'noindex',
};

export default function ParceiroConfiguracoesPage() {
  return <ParceiroConfiguracoesClient />;
}
