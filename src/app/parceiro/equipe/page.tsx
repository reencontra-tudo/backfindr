import type { Metadata } from 'next';
import ParceiroEquipeClient from './client';

export const metadata: Metadata = {
  title: 'Equipe — Portal Parceiro Backfindr',
  robots: 'noindex',
};

export default function ParceiroEquipePage() {
  return <ParceiroEquipeClient />;
}
