'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

export default function GoogleSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Salvar tokens via js-cookie (mesmo mecanismo do login normal)
      setTokens({ access_token: accessToken, refresh_token: refreshToken });
      // Buscar dados do usuário e redirecionar
      fetchMe().then(() => {
        router.replace('/dashboard');
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
