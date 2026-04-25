'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2, Mail } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import Cookies from 'js-cookie';
import { getPostLoginRedirect } from '@/lib/redirectByRole';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
type FormData = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get('plan') || '';
  const { login, isLoading } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Magic Link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState('');
  const [showMagicForm, setShowMagicForm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function redirectToCheckout(slug: string) {
    setCheckoutLoading(true);
    try {
      const token = Cookies.get('access_token');
      if (!token) { router.push('/dashboard'); return; }
      const res = await fetch('/api/v1/checkout/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'plan', plan_slug: slug }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { toast.error(data.error || 'Erro ao criar checkout.'); router.push('/dashboard'); }
    } catch {
      toast.error('Erro ao processar pagamento.'); router.push('/dashboard');
    } finally { setCheckoutLoading(false); }
  }

  const onSubmit = async (data: FormData) => {
    setLoginError('');
    try {
      await login(data.email, data.password);
      toast.success('Bem-vindo de volta!');
      // Usuários que fazem login com e-mail/senha já são existentes
      // — marcar WelcomeModal como visto para não interromper o acesso
      if (typeof window !== 'undefined') {
        localStorage.setItem('backfindr_welcome_shown', '1');
      }
      if (planSlug && planSlug !== 'free') {
        await redirectToCheckout(planSlug);
      } else {
        const { user } = useAuthStore.getState();
        router.push(getPostLoginRedirect(user?.role));
      }
    } catch {
      setLoginError('E-mail ou senha incorretos. Verifique seus dados.');
    }
  };

  const onMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicError('');
    const email = magicEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMagicError('Digite um e-mail válido.');
      return;
    }
    setMagicLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setMagicSent(true);
      } else {
        setMagicError(data.error || 'Erro ao enviar. Tente novamente.');
      }
    } catch {
      setMagicError('Erro ao enviar. Verifique sua conexão.');
    } finally {
      setMagicLoading(false);
    }
  };

  const isProcessing = isLoading || checkoutLoading;

  const inputClass = (hasError: boolean) =>
    `w-full bg-white/[0.04] border ${hasError ? 'border-red-500/60' : 'border-white/[0.08]'} rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all`;

  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,184,166,0.08) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Entrar na sua conta</h1>
          <p className="text-white/40 text-sm">
            Não tem conta?{' '}
            <Link href={`/auth/register${planSlug ? `?plan=${planSlug}` : ''}`} className="text-teal-400 hover:text-teal-300 transition-colors font-medium">
              {planSlug && planSlug !== 'free' ? 'Criar conta' : 'Criar conta grátis'}
            </Link>
          </p>
        </div>

        {/* Formulário de login normal */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1.5 font-medium">Seu e-mail</label>
            <input {...register('email')} type="email" autoComplete="email" placeholder="Ex: joao@gmail.com" className={inputClass(!!errors.email)} />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-white/70 font-medium">Sua senha</label>
              <Link href="/auth/forgot-password" className="text-xs text-teal-400/70 hover:text-teal-300 transition-colors">Esqueceu a senha?</Link>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                className={inputClass(!!errors.password) + ' pr-10'}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {loginError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
              <span className="text-red-400 text-sm">{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-base mt-2"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Entrar</span><ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
            <div className="relative flex justify-center"><span className="text-white/20 text-xs bg-[#080b0f] px-3">ou</span></div>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => window.location.href = '/api/auth/google'}
            className="w-full flex items-center justify-center gap-2.5 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm py-3.5 rounded-xl transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </button>
        </form>

        {/* Magic Link — link discreto abaixo */}
        <div className="mt-5 text-center">
          {!showMagicForm ? (
            <button
              type="button"
              onClick={() => setShowMagicForm(true)}
              className="text-white/30 hover:text-teal-400 text-xs transition-colors"
            >
              Prefere entrar sem senha? Receba um link no seu e-mail
            </button>
          ) : magicSent ? (
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl px-4 py-4 text-center">
              <Mail className="w-5 h-5 text-teal-400 mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium mb-1">Link enviado!</p>
              <p className="text-white/40 text-xs">Verifique sua caixa de entrada em <span className="text-white/60">{magicEmail}</span>. O link expira em 15 minutos.</p>
              <button
                type="button"
                onClick={() => { setMagicSent(false); setMagicEmail(''); }}
                className="mt-3 text-teal-400/60 hover:text-teal-400 text-xs transition-colors"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={onMagicSubmit} className="mt-1">
              <p className="text-white/40 text-xs mb-3">Digite seu e-mail e receba um link para entrar sem senha</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 transition-all"
                />
                <button
                  type="submit"
                  disabled={magicLoading}
                  className="bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 hover:text-white text-sm px-4 py-2.5 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {magicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
                </button>
              </div>
              {magicError && <p className="text-red-400 text-xs mt-2">{magicError}</p>}
              <button
                type="button"
                onClick={() => setShowMagicForm(false)}
                className="mt-2 text-white/20 hover:text-white/40 text-xs transition-colors"
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080b0f]" />}>
      <LoginForm />
    </Suspense>
  );
}
