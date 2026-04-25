'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

// Proteção real contra pre-fetch do iCloud Mail / Gmail:
// O token só é consumido quando o usuário clica no botão.
// Pre-fetchers não clicam em botões — apenas carregam HTML/JS.

function MagicConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMe } = useAuthStore();
  const [status, setStatus] = useState<'waiting' | 'loading' | 'error'>('waiting');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

  if (!token) {
    router.replace('/auth/login?error=magic_link_invalid');
    return null;
  }

  async function handleConfirm() {
    if (status === 'loading') return;
    setStatus('loading');

    try {
      const res = await fetch('/api/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok || !data.access_token) {
        setStatus('error');
        setErrorMsg(data.message || 'Link inválido ou expirado.');
        return;
      }

      setTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: 'Bearer',
      });

      // Usuários que entram via magic link já existem no sistema
      // — marcar WelcomeModal como visto para não interromper o acesso
      if (typeof window !== 'undefined') {
        localStorage.setItem('backfindr_welcome_shown', '1');
      }

      await fetchMe();
      router.replace('/dashboard');
    } catch {
      setStatus('error');
      setErrorMsg('Erro ao verificar o link. Tente novamente.');
    }
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Link inválido</h2>
          <p className="text-white/50 text-sm mb-6">{errorMsg}</p>
          <button
            onClick={() => router.replace('/auth/login')}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Solicitar novo link
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Entrando na sua conta...</p>
        </div>
      </div>
    );
  }

  // status === 'waiting' — aguarda clique do usuário
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-teal-500/10 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-white text-xl font-semibold mb-2">Confirmar acesso</h2>
        <p className="text-white/50 text-sm mb-8">
          Clique no botão abaixo para entrar na sua conta com segurança.
        </p>
        <button
          onClick={handleConfirm}
          className="w-full bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-white font-semibold py-3 rounded-xl transition-colors text-base"
        >
          Entrar na minha conta
        </button>
        <p className="text-white/30 text-xs mt-4">
          Este link é de uso único e expira em 15 minutos.
        </p>
      </div>
    </div>
  );
}

export default function MagicConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    }>
      <MagicConfirmContent />
    </Suspense>
  );
}
