import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Criar conta grátis',
  description: 'Crie sua conta gratuita no Backfindr e comece a proteger seus objetos com QR Code único. Cadastro em menos de 1 minuto.',
  alternates: { canonical: 'https://www.backfindr.com/auth/register' },
  openGraph: {
    title: 'Criar conta grátis | Backfindr',
    description: 'Crie sua conta gratuita e proteja seus objetos com QR Code.',
    url: 'https://www.backfindr.com/auth/register',
  },
  // noindex explícito (23/08/2026) — mesmo padrão do auth/login: form
  // client-side, sem conteúdo indexável. Ver BACKFINDR.md seção 17/19.
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
