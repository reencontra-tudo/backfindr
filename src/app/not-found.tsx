import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center px-5 text-center">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 50% 30% at 50% 30%, rgba(20,184,166,0.06) 0%, transparent 70%)' }} />

      <div className="relative z-10">
        <p className="text-teal-500 text-xs uppercase tracking-[0.2em] mb-6">404</p>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Página não encontrada</h1>
        <p className="text-white/40 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
          Esta página não existe ou foi movida. Se era um link de QR Code, verifique se o código está correto.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-all"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}>
            Ir para o início <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <Link href="/dashboard"
            className="flex items-center justify-center gap-2 border border-white/[0.08] text-white/60 hover:text-white text-sm px-6 py-3 rounded-lg transition-all">
            Meu dashboard
          </Link>
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 text-white/20">
          <div className="w-5 h-5 rounded-md bg-teal-500 flex items-center justify-center">
            <MapPin className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-medium">Backfindr</span>
        </div>
      </div>
    </div>
  );
}
