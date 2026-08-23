import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Entrar na sua conta',
  description: 'Acesse sua conta no Backfindr para gerenciar seus objetos protegidos, ver matches e conversar com quem encontrou algo seu.',
  alternates: { canonical: 'https://www.backfindr.com/auth/login' },
  openGraph: {
    title: 'Entrar na sua conta | Backfindr',
    description: 'Acesse sua conta no Backfindr.',
    url: 'https://www.backfindr.com/auth/login',
  },
  // noindex explícito (23/08/2026) — GSC reportava "Erro soft 404" pra essa
  // página: form client-side, sem conteúdo indexável e sem valor de busca.
  // Ver BACKFINDR.md seção 17/19 para o diagnóstico completo.
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
