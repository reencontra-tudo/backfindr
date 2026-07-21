'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function TrackViewContent() {
  useEffect(() => {
    window.fbq?.('track', 'ViewContent', {
      content_name: 'comecar_landing',
    });
  }, []);

  return null;
}
