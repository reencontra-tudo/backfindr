import type { Metadata } from 'next';
import CheckoutFailureClient from './client';

export const metadata: Metadata = {
  title: 'Pagamento não processado',
  description: 'Houve um problema ao processar seu pagamento no Backfindr.',
  robots: { index: false, follow: false },
};

export default function CheckoutFailurePage() {
  return <CheckoutFailureClient />;
}
