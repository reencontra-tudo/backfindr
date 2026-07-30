import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar na sua conta',
  description: 'Acesse sua conta no Backfindr para gerenciar seus objetos protegidos, ver matches e conversar com quem encontrou algo seu.',
  alternates: { canonical: '/auth/login' },
  openGraph: {
    title: 'Entrar na sua conta | Backfindr',
    description: 'Acesse sua conta no Backfindr.',
    url: '/auth/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
