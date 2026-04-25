'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

function MagicSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      setTokens({ access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer' });
      // Usuários que entram via magic link já existem no sistema
      // — marcar WelcomeModal como visto para não interromper o acesso
      if (typeof window !== 'undefined') {
        localStorage.setItem('backfindr_welcome_shown', '1');
      }
      fetchMe()
        .then(() => {
          const { user } = useAuthStore.getState();
          router.replace(getPostLoginRedirect(user?.role));
        })
        .catch(() => router.replace('/auth/login?error=magic_session_failed'));
    } else {
      router.replace('/auth/login?error=magic_no_tokens');
    }
  }, [searchParams, fetchMe, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Verificando seu link...</p>
      </div>
    </div>
  );
}

export default function MagicSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    }>
      <MagicSuccessContent />
    </Suspense>
  );
}
