'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import Cookies from 'js-cookie';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
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
      if (planSlug && planSlug !== 'free') {
        await redirectToCheckout(planSlug);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setLoginError('E-mail ou senha incorretos. Verifique seus dados.');
    }
  };

  const isProcessing = isLoading || checkoutLoading;

  const inputClass2 = (hasError: boolean) =>
    `w-full bg-white/[0.04] border ${hasError ? 'border-red-500/60' : 'border-white/[0.08]'} rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all`;

  const inputClass = inputClass2;

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
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Entrar</h1>
          <p className="text-white/40 text-sm">
            Não tem conta?{' '}
            <Link href={`/auth/register${planSlug ? `?plan=${planSlug}` : ''}`} className="text-teal-400 hover:text-teal-300 transition-colors">{planSlug && planSlug !== 'free' ? `Criar conta` : 'Criar grátis'}</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-[13px] text-white/50 mb-1.5">E-mail</label>
            <input {...register('email')} type="email" autoComplete="email" placeholder="seu@email.com" className={inputClass(!!errors.email)} />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] text-white/50">Senha</label>
              <Link href="/auth/forgot-password" className="text-[12px] text-white/30 hover:text-white/60 transition-colors">Esqueceu?</Link>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
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
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all text-sm mt-2"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Entrar</span><ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
            <div className="relative flex justify-center"><span className="text-white/20 text-xs bg-[#080b0f] px-3">ou</span></div>
          </div>

          <button
            type="button"
            onClick={() => window.location.href = '/api/auth/google'}
            className="w-full flex items-center justify-center gap-2.5 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/60 hover:text-white text-sm py-2.5 rounded-lg transition-all"
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
