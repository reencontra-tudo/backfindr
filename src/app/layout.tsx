import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['400','500','600','700','800'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap', weight: ['300','400','500','600'] });

export const metadata: Metadata = {
  title: { default: 'Backfindr — Recupere o que perdeu', template: '%s | Backfindr' },
  description: 'Plataforma global de recuperação de objetos perdidos com QR Code e IA.',
  openGraph: { title: 'Backfindr', description: 'Recupere o que perdeu.', url: 'https://backfindr.com.br', siteName: 'Backfindr', locale: 'pt_BR', type: 'website' },
  metadataBase: new URL('https://backfindr.com.br'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#14b8a6" />
      </head>
      <body className="bg-surface text-slate-100 font-body antialiased">
        {children}
        <Toaster position="top-right" toastOptions={{ style: { background:'#1e293b', border:'1px solid #334155', color:'#f1f5f9' } }} />
      </body>
    </html>
  );
}
