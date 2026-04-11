'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

interface Step {
  id: string;
  label: string;
  desc: string;
  href?: string;
  cta: string;
  check: (ctx: { objectsCount: number; hasPush: boolean }) => boolean;
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
    cta: 'Ativar notificações',
    check: ({ hasPush }) => hasPush,
  },
  {
    id: 'share_qr',
    label: 'Cole o QR Code no objeto',
    desc: 'Imprima ou salve o QR e cole no objeto físico.',
    href: '/dashboard/objects',
    cta: 'Ver meus objetos',
    check: ({ objectsCount }) => objectsCount > 0,
  },
];

interface Props {
  objectsCount: number;
  onDismiss: () => void;
}

export default function OnboardingChecklist({ objectsCount, onDismiss }: Props) {
  const [hasPush, setHasPush] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasPush(Notification.permission === 'granted');
    }
    const d = localStorage.getItem('onboarding_dismissed');
    if (d) setDismissed(true);
  }, []);

  const ctx = { objectsCount, hasPush };
  const completed = STEPS.filter(s => s.check(ctx)).length;
  const allDone = completed === STEPS.length;

  const handleDismiss = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setDismissed(true);
    onDismiss();
  };

  const enablePush = async () => {
    const perm = await Notification.requestPermission();
    setHasPush(perm === 'granted');
  };

  if (dismissed || allDone) return null;

  return (
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
          <p className="text-white/40 text-xs mt-0.5">{completed} de {STEPS.length} concluídos</p>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${s.check(ctx) ? 'bg-teal-500' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/[0.06] rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500"
          style={{ width: `${(completed / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        {STEPS.map(step => {
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
                step.href ? (
                  <Link href={step.href}
                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-medium flex-shrink-0 transition-colors">
                    {step.cta} <ChevronRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <button onClick={enablePush}
                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-medium flex-shrink-0 transition-colors">
                    {step.cta} <ChevronRight className="w-3 h-3" />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
