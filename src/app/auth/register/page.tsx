'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const schema = z
  .object({
    name: z.string().min(2, 'Nome muito curto'),
    email: z.string().email('E-mail inválido'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Uma letra maiúscula')
      .regex(/[0-9]/, 'Um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const BENEFITS = [
  'QR Code único para cada objeto',
  'Notificação imediata ao ser encontrado',
  'Histórico completo de recuperações',
  'Suporte a pets, documentos e eletrônicos',
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password', '');
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strengthScore = strength.filter(Boolean).length;

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser({ name: data.name, email: data.email, password: data.password, phone: data.phone });
      toast.success('Conta criada! Bem-vindo ao Backfindr 🎉');
      router.push('/dashboard');
    } catch {
      toast.error('Erro ao criar conta. Verifique os dados.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-brand-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl relative z-10 grid md:grid-cols-2 gap-10 items-center">
        {/* Left — benefits */}
        <div className="hidden md:block">
          <Link href="/" className="inline-flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center glow-teal">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">Backfindr</span>
          </Link>

          <h2 className="font-display text-4xl font-bold text-white mb-3 leading-tight">
            Proteja o que<br />
            <span className="gradient-text">é seu.</span>
          </h2>
          <p className="text-slate-400 mb-10">
            Registre grátis e tenha a maior chance de recuperar seus objetos.
          </p>

          <ul className="space-y-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-brand-400" />
                </div>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Right — form */}
        <div>
          <div className="md:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center glow-teal">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-white">Backfindr</span>
            </Link>
          </div>

          <div className="text-center md:text-left mb-6">
            <h1 className="font-display text-3xl font-bold text-white">Criar conta grátis</h1>
            <p className="text-slate-400 text-sm mt-1">
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">
                Entrar
              </Link>
            </p>
          </div>

          <div className="glass rounded-2xl p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome completo</label>
                <input
                  {...register('name')}
                  placeholder="João Silva"
                  className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                    errors.name ? 'border-red-500' : 'border-surface-border'
                  }`}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                    errors.email ? 'border-red-500' : 'border-surface-border'
                  }`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Phone (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Telefone <span className="text-slate-500">(opcional)</span>
                </label>
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="+55 11 99999-9999"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full bg-surface border rounded-xl px-4 py-3 pr-11 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                      errors.password ? 'border-red-500' : 'border-surface-border'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {password && (
                  <div className="flex gap-1 mt-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strengthScore
                            ? strengthScore <= 1
                              ? 'bg-red-500'
                              : strengthScore === 2
                              ? 'bg-accent-yellow'
                              : strengthScore === 3
                              ? 'bg-brand-400'
                              : 'bg-brand-500'
                            : 'bg-surface-border'
                        }`}
                      />
                    ))}
                  </div>
                )}
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar senha</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-brand-500 transition-colors ${
                    errors.confirmPassword ? 'border-red-500' : 'border-surface-border'
                  }`}
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 glow-teal mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Criar conta grátis
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                Ao criar conta, você concorda com os{' '}
                <Link href="/terms" className="text-brand-500 hover:underline">Termos de Uso</Link>{' '}
                e{' '}
                <Link href="/privacy" className="text-brand-500 hover:underline">Política de Privacidade</Link>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
