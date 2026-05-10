import type { Metadata } from 'next';
import KeysFlowClient from './client';

export const metadata: Metadata = {
  title: 'Perdeu as chaves? — Backfindr',
  description: 'Registre suas chaves perdidas agora. A rede Backfindr conecta você com quem encontrou.',
  robots: 'noindex',
};

export default function KeysFlowPage() {
  return <KeysFlowClient />;
}
