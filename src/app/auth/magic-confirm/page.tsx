'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

function MagicConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMe } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'confirming' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/auth/login?error=magic_link_invalid');
      return;
    }

    // Mostrar tela de confirmação antes de consumir o token
    // Isso evita que o pre-fetch do iCloud/Gmail consuma o token
    setStatus('confirming');

    // Auto-confirmar após 500ms (UX fluida, mas não instantânea para evitar pre-fetch)
    const timer = setTimeout(async () => {
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

        await fetchMe();
        router.replace('/dashboard');
      } catch {
        setStatus('error');
        setErrorMsg('Erro ao verificar o link. Tente novamente.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchParams, fetchMe, router]);

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Verificando seu link...</p>
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
