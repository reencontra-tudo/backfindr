'use client';

import { useEffect } from 'react';

/**
 * usePublicPushPrompt
 * Solicita permissão de notificação em páginas públicas
 * (Custody e Delivery) sem exigir autenticação.
 *
 * Registra o SW mas não subscreve — a subscrição
 * com chave VAPID só acontece após o usuário criar conta.
 * O objetivo aqui é apenas pré-aquecer a permissão.
 */
export function usePublicPushPrompt(delay = 3000) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    // Aguardar alguns segundos antes de pedir
    const timer = setTimeout(async () => {
      try {
        await Notification.requestPermission();
      } catch {
        // silencioso — browser pode bloquear em contexto não-seguro
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);
}
