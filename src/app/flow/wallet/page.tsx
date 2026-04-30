import type { Metadata } from 'next';
import WalletFlowClient from './client';

export const metadata: Metadata = {
  title: 'Perdeu a carteira? — Backfindr',
  description: 'Registre sua carteira perdida agora. A rede Backfindr conecta você com quem encontrou.',
  robots: 'noindex',
};

export default function WalletFlowPage() {
  return <WalletFlowClient />;
}
