'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { isTrackingBlocked } from '@/lib/trackingGuard';

// Google Analytics 4 e Meta Pixel. Os scripts e as estratégias de carregamento são exatamente os que
// estavam no layout raiz; a única diferença é que NÃO são carregados em páginas com token na URL
// (regras em src/lib/trackingGuard.ts). Em qualquer outra rota nada muda: mesmos scripts, mesmo PageView.
// Sem os IDs de ambiente, nada é carregado (como antes).
export default function TrackingScripts({ gaId, pixelId }: { gaId?: string; pixelId?: string }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(!isTrackingBlocked(window.location.pathname, window.location.search, window.location.hash));
  }, [pathname]);

  if (!allowed) return null;

  return (
    <>
      {/* Google Analytics 4 */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                  send_page_view: true,
                });
              `}
          </Script>
        </>
      )}

      {/* Meta Pixel — PageView automático em todo o site */}
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
        </Script>
      )}
    </>
  );
}
