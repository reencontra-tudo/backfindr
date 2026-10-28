import type { Metadata } from 'next';
import ProtectFlowClient from './client';

export const metadata: Metadata = {
  title: 'Quero me prevenir — Backfindr',
  description: 'Gere um QR Code para imprimir e colar nos seus pertences. Se alguém o escanear, você é avisado, sem mostrar seu número.',
  robots: 'noindex',
};

export default function ProtectFlowPage() {
  return <ProtectFlowClient />;
}
