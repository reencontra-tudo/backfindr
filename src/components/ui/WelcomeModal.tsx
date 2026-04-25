'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Package, QrCode, Zap, Bell, ArrowRight, Sparkles } from 'lucide-react';

interface WelcomeModalProps {
  userName?: string;
  onClose: () => void;
  onStartTour: () => void;
}

const HIGHLIGHTS = [
  {
    icon: Package,
    color: 'text-teal-400 bg-teal-400/10',
    title: 'Registre seus objetos',
    desc: 'Celular, carteira, pet, chaves — tudo com QR Code único e rastreável.',
  },
  {
    icon: QrCode,
    color: 'text-purple-400 bg-purple-400/10',
    title: 'Cole o QR Code',
    desc: 'Imprima a etiqueta e cole no objeto. Quem achar escaneia e te avisa.',
  },
  {
    icon: Zap,
    color: 'text-yellow-400 bg-yellow-400/10',
    title: 'Matching automático',
    desc: 'A IA cruza objetos perdidos e achados e notifica quando há correspondência.',
  },
  {
    icon: Bell,
    color: 'text-blue-400 bg-blue-400/10',
    title: 'Notificações em tempo real',
    desc: 'Receba alertas no celular quando alguém escanear ou reportar seu objeto.',
  },
];

export default function WelcomeModal({ userName, onClose, onStartTour }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animação de entrada
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function handleStartTour() {
    setVisible(false);
    setTimeout(onStartTour, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-[#0b1120] border border-white/[0.08] rounded-2xl shadow-2xl z-10 overflow-hidden transition-all duration-300 ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'
        }`}
      >
        {/* Header gradient */}
        <div className="relative h-28 bg-gradient-to-br from-teal-600/30 via-teal-500/10 to-transparent flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.15),transparent_70%)]" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">
                Bem-vindo{userName ? `, ${userName.split(' ')[0]}` : ''}!
              </p>
              <p className="text-teal-300/70 text-xs">Sua conta está pronta</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-white/50 text-sm mb-5 text-center">
            O Backfindr protege seus objetos com QR Code inteligente e matching por IA.
            Veja como funciona:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {HIGHLIGHTS.map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-1.5"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-white text-xs font-semibold leading-tight">{title}</p>
                <p className="text-white/40 text-[11px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-2.5">
            <Link
              href="/dashboard/objects/new"
              onClick={handleClose}
              className="flex items-center justify-center gap-2 w-full bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-3 rounded-xl transition-all"
              style={{ boxShadow: '0 0 20px rgba(20,184,166,0.3)' }}
            >
              <Package className="w-4 h-4" />
              Registrar meu primeiro objeto
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={handleStartTour}
              className="flex items-center justify-center gap-2 w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/70 hover:text-white text-sm py-2.5 rounded-xl transition-all"
            >
              Ver tour guiado do painel
            </button>

            <button
              onClick={handleClose}
              className="w-full text-white/30 hover:text-white/50 text-xs py-1.5 transition-colors"
            >
              Explorar por conta própria
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
