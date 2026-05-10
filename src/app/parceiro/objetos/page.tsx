import type { Metadata } from 'next';
import ParceiroObjetosClient from './client';

export const metadata: Metadata = {
  title: 'Objetos — Portal Parceiro Backfindr',
  robots: 'noindex',
};

export default function ParceiroObjetosPage() {
  return <ParceiroObjetosClient />;
}
