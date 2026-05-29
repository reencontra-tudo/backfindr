'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * PushPermissionBanner
 * Exibe um banner sutil pedindo permissão de notificação.
 * Aparece apenas se a permissão ainda não foi concedida.
 * Usado no PWA do porteiro e nas páginas de Custody/Delivery.
 */
export default function PushPermissionBanner() {
  const { register } = usePushNotifications();
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    // Mostrar apenas se ainda não decidido
    if (Notification.permission === 'default') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleAtivar = async () => {
    setLoading(true);
    try {
      await register();
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-3 mt-2 bg-[#162C50] border border-[#3B82F6]/30 rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-[#3B82F6]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold">Ativar notificações</p>
        <p className="text-[#6B8EC4] text-[11px] mt-0.5 leading-snug">
          Receba alertas de encomendas e retiradas em tempo real.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleAtivar}
          disabled={loading}
          className="px-3 py-1.5 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Ativar'}
        </button>
        <button
          onClick={() => setShow(false)}
          className="text-[#6B8EC4] hover:text-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
