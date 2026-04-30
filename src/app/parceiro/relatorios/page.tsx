import type { Metadata } from 'next';
import ParceiroRelatoriosClient from './client';

export const metadata: Metadata = {
  title: 'Relatórios — Portal Parceiro Backfindr',
  robots: 'noindex',
};

export default function ParceiroRelatoriosPage() {
  return <ParceiroRelatoriosClient />;
}
