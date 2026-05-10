import type { Metadata } from 'next';
import ProtectFlowClient from './client';

export const metadata: Metadata = {
  title: 'Quero me prevenir — Backfindr',
  description: 'Gere um QR Code gratuito para seus pertences. Se alguém encontrar, entra em contato sem ver seu número.',
  robots: 'noindex',
};

export default function ProtectFlowPage() {
  return <ProtectFlowClient />;
}
