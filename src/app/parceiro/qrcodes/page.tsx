import type { Metadata } from 'next';
import ParceiroQRCodesClient from './client';

export const metadata: Metadata = {
  title: 'QR Codes — Portal Parceiro Backfindr',
  robots: 'noindex',
};

export default function ParceiroQRCodesPage() {
  return <ParceiroQRCodesClient />;
}
