'use client';

import { useEffect } from 'react';
import { quandoTrackerPronto } from '@/lib/trackerReady';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function TrackViewContent() {
  // Na entrada direta o Pixel ainda não carregou quando este efeito roda: espera o `fbq` existir (uma vez só).
  useEffect(() => {
    return quandoTrackerPronto('fbq', () => {
      window.fbq?.('track', 'ViewContent', {
        content_name: 'comecar_landing',
      });
    });
  }, []);

  return null;
}
