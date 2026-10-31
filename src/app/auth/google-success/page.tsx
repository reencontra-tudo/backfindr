'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

function GoogleSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    // Os tokens chegam em cookie, gravado pelo callback OAuth. A URL não os carrega mais; links
    // antigos com tokens na query são limpos no middleware antes de a página renderizar.
    const isNew = searchParams.get('new') === '1';

    if (Cookies.get('access_token') && Cookies.get('refresh_token')) {
      // Para usuários existentes, marcar o WelcomeModal como já exibido
      // para evitar que apareça em novos dispositivos/browsers
      if (!isNew && typeof window !== 'undefined') {
        localStorage.setItem('backfindr_welcome_shown', '1');
      }
      // Buscar dados do usuário e redirecionar conforme role
      fetchMe().then(() => {
        const { user } = useAuthStore.getState();
        router.replace(getPostLoginRedirect(user?.role));
      }).catch(() => {
        router.replace('/auth/login?error=google_session_failed');
      });
    } else {
      router.replace('/auth/login?error=google_no_tokens');
    }
  }, [searchParams, fetchMe, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Entrando com Google...</p>
      </div>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    }>
      <GoogleSuccessContent />
    </Suspense>
  );
}
