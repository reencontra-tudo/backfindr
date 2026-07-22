import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import Script from 'next/script';
import AssistantWidget from '@/components/AssistantWidget';
import { PostHogProvider } from '@/providers/PostHogProvider';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

export const viewport: Viewport = {
  themeColor: '#080b0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: 'Backfindr — Recupere o que perdeu',
    template: '%s | Backfindr',
  },
  description:
    'Plataforma global de recuperação de objetos perdidos com QR Code único, IA de matching e chat mediado para devolução segura.',
  keywords: ['objeto perdido', 'achado', 'recuperação', 'pet perdido', 'QR Code', 'rastreamento'],
  authors: [{ name: 'Backfindr' }],
  creator: 'Backfindr',
  publisher: 'Backfindr',
  metadataBase: new URL('https://backfindr.com'),
  alternates: { canonical: 'https://backfindr.com' },

  openGraph: {
    title: 'Backfindr — Recupere o que perdeu',
    description: 'Plataforma global de objetos perdidos com QR Code e IA.',
    url: 'https://backfindr.com',
    siteName: 'Backfindr',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630, alt: 'Backfindr' }],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Backfindr — Recupere o que perdeu',
    description: 'Plataforma global de objetos perdidos com QR Code e IA.',
    images: ['/icons/og-image.png'],
  },

  // PWA
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Backfindr',
  },
  applicationName: 'Backfindr',

  icons: {
    icon: [
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512x512.png' },
    ],
  },

  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        {/* Schema.org — WebSite + Organization (SEO estruturado) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://backfindr.com/#website',
                  url: 'https://backfindr.com',
                  name: 'Backfindr',
                  description: 'Plataforma global de recuperação de objetos perdidos com QR Code único, IA de matching e chat mediado.',
                  inLanguage: 'pt-BR',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: { '@type': 'EntryPoint', urlTemplate: 'https://backfindr.com/buscar?q={search_term_string}' },
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://backfindr.com/#organization',
                  name: 'Backfindr',
                  url: 'https://backfindr.com',
                  logo: { '@type': 'ImageObject', url: 'https://backfindr.com/icons/icon-512x512.png', width: 512, height: 512 },
                  sameAs: ['https://www.instagram.com/backfindr', 'https://twitter.com/backfindr'],
                  contactPoint: { '@type': 'ContactPoint', email: 'suporte@backfindr.com', contactType: 'customer support', availableLanguage: 'Portuguese' },
                },
              ],
            }),
          }}
        />
        {/* iOS PWA meta tags — Next.js metadata API não cobre todos */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Backfindr" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#080b0f" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

        {/* Splash screens iOS */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
      </head>
      <body className="bg-[#080b0f] text-white font-body antialiased">
        <PostHogProvider>
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#111318',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: '13px',
            },
          }}
        />

        {/* Assistente Findr — disponível em toda a plataforma */}
        <AssistantWidget />

        {/* Google Analytics 4 */}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  send_page_view: true,
                });
              `}
            </Script>
          </>
        )}

        {/* Microsoft Clarity — gravação de sessão + mapa de calor */}
        {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
          <Script id="microsoft-clarity" strategy="lazyOnload">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
            `}
          </Script>
        )}

        {/* Meta Pixel — PageView automático em todo o site */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
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
              fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}

        {/* Register Service Worker */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then(reg => console.log('SW registered:', reg.scope))
                  .catch(err => console.warn('SW error:', err));
              });
            }
          `}
        </Script>
        </PostHogProvider>
      </body>
    </html>
  );
}
