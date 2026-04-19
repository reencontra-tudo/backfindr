'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2, Check, Zap, Building2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import Cookies from 'js-cookie';

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Z]/, 'Uma letra maiúscula').regex(/[0-9]/, 'Um número'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Senhas não conferem', path: ['confirmPassword'] });

type FormData = z.infer<typeof schema>;

const BENEFITS = [
  'QR Code único e permanente para cada objeto',
  'Notificação imediata quando encontrado',
  'Chat mediado com privacidade garantida',
  'Suporte a pets, documentos e eletrônicos',
  'Matching automático por IA',
];

const PLAN_INFO: Record<string, { name: string; price: string; icon: React.ReactNode; color: string }> = {
  pro:      { name: 'Pro',      price: 'R$ 29,00/mês',  icon: <Zap className="w-4 h-4" />,      color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  business: { name: 'Business', price: 'R$ 149,00/mês', icon: <Building2 className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get('plan') || '';
  const planInfo = PLAN_INFO[planSlug] || null;

  const { register: registerUser, isLoading } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const password = watch('password', '');
  const strengthScore = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const strengthColor = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-teal-500'][strengthScore - 1] ?? 'bg-white/10';

  async function redirectToCheckout(slug: string) {
    setCheckoutLoading(true);
    try {
      // O token é armazenado em cookie pelo setTokens após o login
      const token = Cookies.get('access_token');
      if (!token) {
        router.push('/dashboard');
        return;
      }
      const res = await fetch('/api/v1/checkout/mercadopago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'plan', plan_slug: slug }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Erro ao criar checkout. Tente novamente.');
        router.push('/dashboard');
      }
    } catch {
      toast.error('Erro ao processar pagamento. Tente novamente.');
      router.push('/dashboard');
    } finally {
      setCheckoutLoading(false);
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const result = await registerUser({ name: data.name, email: data.email, password: data.password, phone: data.phone });
      toast.success('Conta criada com sucesso!');

      // Se veio de um plano pago, redirecionar para checkout
      if (planSlug && planSlug !== 'free') {
        await redirectToCheckout(planSlug);
      } else {
        router.push('/dashboard');
      }
    } catch {
      toast.error('Erro ao criar conta. Verifique os dados.');
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full bg-white/[0.04] border ${hasError ? 'border-red-500/60' : 'border-white/[0.08]'} rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 focus:bg-white/[0.06] transition-all`;

  const isProcessing = isLoading || checkoutLoading;
  const buttonLabel = planInfo
    ? `Criar conta e assinar ${planInfo.name}`
    : 'Criar conta grátis';

  return (
    <div className="min-h-screen bg-[#080b0f] flex">

      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 border-r border-white/[0.06] p-10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 100% 60% at 0% 100%, rgba(20,184,166,0.08) 0%, transparent 70%)' }} />

        <Link href="/" className="flex items-center gap-2.5 relative z-10">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white tracking-tight leading-tight mb-3">
            Proteja o que<br />é seu.
          </h2>
          <p className="text-white/40 text-sm mb-10 leading-relaxed">
            Plataforma global de recuperação de objetos perdidos. Gratuito para sempre.
          </p>

          <ul className="space-y-3.5">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full border border-teal-500/40 bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-teal-400" strokeWidth={2.5} />
                </div>
                <span className="text-white/50 text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/20 text-xs relative z-10">© 2026 Backfindr</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-semibold text-[15px]">Backfindr</span>
          </Link>

          {/* Banner de plano selecionado */}
          {planInfo && (
            <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 mb-6 ${planInfo.color}`}>
              <div className={`p-1.5 rounded-lg ${planInfo.color}`}>
                {planInfo.icon}
              </div>
              <div>
                <p className="text-xs text-white/40">Você está assinando</p>
                <p className="font-semibold text-sm text-white">Plano {planInfo.name} — {planInfo.price}</p>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Criar conta</h1>
            <p className="text-white/40 text-sm">
              Já tem conta?{' '}
              <Link href={`/auth/login${planSlug ? `?plan=${planSlug}` : ''}`} className="text-teal-400 hover:text-teal-300 transition-colors">
                Entrar
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">Nome completo</label>
              <input {...register('name')} placeholder="João Silva" className={inputClass(!!errors.name)} />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">E-mail</label>
              <input {...register('email')} type="email" placeholder="seu@email.com" className={inputClass(!!errors.email)} />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">
                Telefone <span className="text-white/20">(opcional)</span>
              </label>
              <input {...register('phone')} type="tel" placeholder="+55 11 99999-9999" className={inputClass(false)} />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  className={inputClass(!!errors.password) + ' pr-10'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="flex gap-1 mt-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i < strengthScore ? strengthColor : 'bg-white/10'}`} />
                  ))}
                </div>
              )}
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[13px] text-white/50 mb-1.5">Confirmar senha</label>
              <input
                {...register('confirmPassword', { onBlur: () => setConfirmTouched(true) })}
                type="password"
                placeholder="••••••••"
                className={inputClass(!!(errors.confirmPassword && confirmTouched))}
              />
              {errors.confirmPassword && confirmTouched && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all text-sm mt-2"
              style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
            >
              {isProcessing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><span>{buttonLabel}</span><ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>
              }
            </button>

            <p className="text-white/20 text-xs text-center leading-relaxed">
              Ao criar conta, você concorda com os{' '}
              <Link href="/terms" className="text-white/40 hover:text-white transition-colors underline underline-offset-2">Termos de Uso</Link>
              {' '}e{' '}
              <Link href="/privacy" className="text-white/40 hover:text-white transition-colors underline underline-offset-2">Política de Privacidade</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080b0f]" />}>
      <RegisterForm />
    </Suspense>
  );
}
