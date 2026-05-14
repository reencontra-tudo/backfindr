import type { Metadata } from 'next';
import PortariaPWAClient from './client';

export const metadata: Metadata = {
  title: 'Backfindr Portaria',
  description: 'Sistema de portaria inteligente',
  manifest: '/manifest.json',
  viewport: { width: 'device-width', initialScale: 1, maximumScale: 1 },
  themeColor: '#0f2544',
};

export default function PortariaPWAPage({
  params,
}: {
  params: { condominioId: string };
}) {
  return <PortariaPWAClient condominioId={params.condominioId} />;
}
