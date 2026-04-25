import type { Metadata } from 'next';
import CheckoutSuccessClient from './client';

export const metadata: Metadata = {
  title: 'Pagamento Confirmado',
  description: 'Seu plano foi ativado com sucesso no Backfindr.',
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessClient />;
}
