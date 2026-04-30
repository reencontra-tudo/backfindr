import type { Metadata } from 'next';
import VehicleFlowClient from './client';

export const metadata: Metadata = {
  title: 'Veículo roubado ou perdido? — Backfindr',
  description: 'Registre seu carro, moto ou veículo agora. A rede Backfindr monitora e avisa se ele aparecer.',
  robots: 'noindex',
};

export default function VehicleFlowPage() {
  return <VehicleFlowClient />;
}
