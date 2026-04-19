'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, X, Smartphone, Bell } from 'lucide-react';

// ─── Modal de instalação PWA ──────────────────────────────────────────────────
function InstallPWAModal({ onClose }: { onClose: () => void }) {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-[#0f1623] border border-white/[0.08] rounded-2xl p-6 shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Ativar notificações</p>
            <p className="text-white/40 text-xs">Instale o app na tela inicial</p>
          </div>
        </div>

        <p className="text-white/50 text-xs mb-5 leading-relaxed">
          Para receber notificações em tempo real quando seu objeto for encontrado, instale o Backfindr na tela inicial do seu celular.
        </p>

        {isIOS ? (
          <div className="space-y-3">
            <p className="text-white/70 text-xs font-medium mb-2">No iPhone / iPad:</p>
            {[
              { step: '1', text: 'Toque no ícone de compartilhar (□↑) na barra do Safari' },
              { step: '2', text: 'Role para baixo e toque em "Adicionar à Tela de Início"' },
              { step: '3', text: 'Confirme tocando em "Adicionar" no canto superior direito' },
              { step: '4', text: 'Abra o app pela tela inicial e ative as notificações' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-white/50 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-white/70 text-xs font-medium mb-2">No Android:</p>
            {[
              { step: '1', text: 'Toque no menu (⋮) no canto superior direito do Chrome' },
              { step: '2', text: 'Toque em "Adicionar à tela inicial" ou "Instalar app"' },
              { step: '3', text: 'Confirme tocando em "Adicionar"' },
              { step: '4', text: 'Abra o app pela tela inicial e ative as notificações' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-white/50 text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────
interface Step {
  id: string;
  label: string;
  desc: string;
  href?: string;
  cta: string;
  check: (ctx: { objectsCount: number; hasPush: boolean; hasLostObject: boolean }) => boolean;
  /** Se true, o passo só aparece quando há objeto perdido */
  onlyForLost?: boolean;
}

const STEPS: Step[] = [
  {
    id: 'register_object',
    label: 'Registre seu primeiro objeto',
    desc: 'Adicione fotos e receba um QR Code único.',
    href: '/dashboard/objects/new',
    cta: 'Registrar agora',
    check: ({ objectsCount }) => objectsCount > 0,
  },
  {
    id: 'enable_push',
    label: 'Ative as notificações',
    desc: 'Seja avisado imediatamente quando seu objeto for encontrado.',
    cta: 'Como ativar',
    check: ({ hasPush }) => hasPush,
  },
  {
    id: 'share_qr',
    label: 'Cole o QR Code no objeto',
    desc: 'Imprima ou salve o QR e cole no objeto físico para facilitar a devolução.',
    href: '/dashboard/objects',
    cta: 'Ver meus objetos',
    check: ({ objectsCount }) => objectsCount > 0,
    onlyForLost: false,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  objectsCount: number;
  /** Statuses dos objetos do usuário para filtrar passos contextuais */
  objectStatuses?: string[];
  onDismiss: () => void;
}

export default function OnboardingChecklist({ objectsCount, objectStatuses = [], onDismiss }: Props) {
  const [hasPush, setHasPush] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showPWAModal, setShowPWAModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasPush(Notification.permission === 'granted');
    }
    const d = localStorage.getItem('onboarding_dismissed');
    if (d) setDismissed(true);
  }, []);

  // Há pelo menos um objeto perdido ou roubado?
  const hasLostObject = objectStatuses.some(s => s === 'lost' || s === 'stolen');

  // Filtrar passos: o passo de QR Code só aparece se NÃO houver apenas objetos perdidos
  // (se o usuário só tem objetos perdidos, o QR Code não faz sentido pois ele não tem o objeto)
  const visibleSteps = STEPS.filter(step => {
    if (step.id === 'share_qr') {
      // Mostrar QR Code apenas se o usuário tem objetos que não são "lost" ou "stolen"
      // (ou seja, tem objetos que ainda estão com ele: found, returned, ou nenhum objeto ainda)
      const hasNonLostObject = objectStatuses.some(s => s !== 'lost' && s !== 'stolen');
      return objectsCount === 0 || hasNonLostObject;
    }
    return true;
  });

  const ctx = { objectsCount, hasPush, hasLostObject };
  const completed = visibleSteps.filter(s => s.check(ctx)).length;
  const allDone = completed === visibleSteps.length;

  const handleDismiss = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
    onDismiss();
  };

  const handleEnablePush = async () => {
    // Tenta solicitar permissão nativa primeiro
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setHasPush(true);
        return;
      }
    }
    // Se não conseguiu (iOS Safari sem PWA), mostra o modal de instalação
    setShowPWAModal(true);
  };

  if (dismissed || allDone) return null;

  return (
    <>
      {showPWAModal && <InstallPWAModal onClose={() => setShowPWAModal(false)} />}

      <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 mb-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between mb-4 pr-6">
          <div>
            <p className="text-white font-semibold text-sm">Começando com o Backfindr</p>
            <p className="text-white/40 text-xs mt-0.5">{completed} de {visibleSteps.length} concluídos</p>
          </div>
          <div className="flex gap-1">
            {visibleSteps.map((s) => (
              <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${s.check(ctx) ? 'bg-teal-500' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/[0.06] rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${(completed / visibleSteps.length) * 100}%` }}
          />
        </div>

        <div className="space-y-3">
          {visibleSteps.map(step => {
            const done = step.check(ctx);
            return (
              <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${done ? 'opacity-50' : 'hover:bg-white/[0.03]'}`}>
                {done
                  ? <CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" />
                  : <Circle className="w-5 h-5 text-white/20 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-white/40 line-through' : 'text-white'}`}>{step.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{step.desc}</p>
                </div>
                {!done && (
                  step.id === 'enable_push' ? (
                    <button
                      onClick={handleEnablePush}
                      className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-medium flex-shrink-0 transition-colors"
                    >
                      {step.cta} <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : step.href ? (
                    <Link href={step.href}
                      className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-medium flex-shrink-0 transition-colors">
                      {step.cta} <ChevronRight className="w-3 h-3" />
                    </Link>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
