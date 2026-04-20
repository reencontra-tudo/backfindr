'use client';

import Link from 'next/link';
import { MapPin, X } from 'lucide-react';
import ProgressBar from './ProgressBar';

interface FlowLayoutProps {
  children: React.ReactNode;
  step: number;
  totalSteps: number;
  exitHref?: string;
}

export default function FlowLayout({
  children,
  step,
  totalSteps,
  exitHref = '/',
}: FlowLayoutProps) {
  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">
      {/* Topo: logo + sair */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
        <Link
          href={exitHref}
          className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
          aria-label="Sair do fluxo"
        >
          <X className="w-4 h-4 text-white/50" />
        </Link>
      </div>

      {/* Barra de progresso */}
      <div className="px-5 pb-6">
        <ProgressBar current={step} total={totalSteps} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 px-5 pb-10 max-w-lg mx-auto w-full">
        {children}
      </div>

      {/* Rodapé leve */}
      <div className="px-5 py-4 text-center">
        <p className="text-white/20 text-xs">
          Seu contato fica protegido.{' '}
          <Link href="/privacy" className="underline hover:text-white/40 transition-colors">
            Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}
