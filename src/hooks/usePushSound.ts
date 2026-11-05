'use client';
import { useEffect } from 'react';
import { handlePushMessage } from '@/lib/pushSound';

/** Escuta o aviso do service worker e toca o som curto com o app aberto. Montar uma vez (layout do dashboard). */
export function usePushSound() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => { handlePushMessage(e.data); };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
}
