import type { Metadata } from 'next';
import CheckoutPendingClient from './client';

export const metadata: Metadata = {
  title: 'Pagamento em análise',
  description: 'Seu pagamento está sendo processado. Você receberá uma confirmação em breve.',
  robots: { index: false, follow: false },
};

export default function CheckoutPendingPage() {
  return <CheckoutPendingClient />;
}
