'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * PushPromptCard
 * Item 5 do fechamento do ciclo de "encontrei" (22/08/2026) — push é o
 * canal mais rápido pro dono saber que alguém encontrou seu objeto, mas a
 * maioria nunca chega a conceder a permissão porque o popup nativo do
 * navegador nunca é pedido de forma intencional em nenhum momento do
 * produto (a página de sucesso do cadastro só MENCIONA "ative as
 * notificações" em texto solto, sem botão nenhum atrás).
 *
 * Este card pede a permissão de forma explícita e contextual, mas NUNCA
 * dispara o popup nativo sozinho — só quando a pessoa clica em "Sim,
 * ativar" aqui dentro. Popup nativo só pode ser pedido de forma eficaz
 * uma vez; se for recusado ali, só muda depois manualmente nas
 * configurações do navegador — por isso a decisão de mostrar esse popup
 * fica inteiramente sob controle do produto, não do carregamento da
 * página.
 *
 * Persistência: localStorage, não o banco — é preferência de UI local
 * ("já vi esse convite e disse não"), não um dado que precise sincronizar
 * entre dispositivos. Sem escolha registrada, o card pode reaparecer em
 * visitas futuras (ex: volta ao dashboard) — só some de vez quando a
 * pessoa responde explicitamente a uma das duas opções.
 */
const STORAGE_KEY = 'bf_push_prompt_choice';

interface PushPromptCardProps {
  /** Texto de contexto acima do CTA — varia por onde o card aparece. */
  description?: string;
  className?: string;
}

export default function PushPromptCard({
  description = 'Seja avisado na hora se alguém encontrar ou escanear um dos seus objetos.',
  className = '',
}: PushPromptCardProps) {
  const { register } = usePushNotifications();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return; // já decidiu antes (aceitou ou recusou) — não insiste
    // 'default' é o único estado em que vale a pena perguntar — 'granted'
    // já está ativo, 'denied' só muda nas configurações do navegador (pedir
    // de novo aqui não adianta nada, o browser nega sem nem mostrar popup).
    if (Notification.permission === 'default') setShow(true);
  }, []);

  if (!show) return null;

  const handleAtivar = async () => {
    setLoading(true);
    try {
      await register();
      window.localStorage.setItem(STORAGE_KEY, 'accepted');
    } finally {
      setLoading(false);
      setShow(false);
    }
  };

  const handleRecusar = () => {
    // Recusa explícita — registra a decisão, o card não aparece mais.
    window.localStorage.setItem(STORAGE_KEY, 'declined');
    setShow(false);
  };

  const handleFechar = () => {
    // Fechar pelo X é só "agora não decidi" — nada persiste, então o card
    // pode voltar a aparecer numa visita futura (ex: volta ao dashboard),
    // diferente da recusa explícita do botão "Agora não".
    setShow(false);
  };

  return (
    <div
      className={`bg-teal-500/[0.06] border border-teal-500/20 rounded-2xl p-4 flex items-start gap-3 text-left ${className}`}
    >
      <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-teal-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold mb-0.5">Ativar notificações push?</p>
        <p className="text-white/45 text-xs leading-relaxed mb-3">{description}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAtivar}
            disabled={loading}
            className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 rounded-lg text-white text-xs font-bold transition-colors"
          >
            {loading ? 'Ativando…' : 'Sim, ativar'}
          </button>
          <button
            onClick={handleRecusar}
            className="px-3 py-2 text-white/40 hover:text-white/70 text-xs font-medium transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
      <button
        onClick={handleFechar}
        aria-label="Fechar"
        className="text-white/25 hover:text-white/50 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
