'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
      toast.success('Bem-vindo de volta!');
      router.push('/dashboard');
    } catch {
      toast.error('E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-brand-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center glow-teal">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-white">Backfindr</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-white">Entrar na conta</h1>
          <p className="text-slate-400 text-sm mt-2">
            Não tem conta?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 transition-colors">
              Criar grátis
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className={`w-full bg-surface border rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm transition-colors outline-none focus:border-brand-500 ${
                  errors.email ? 'border-red-500' : 'border-surface-border'
                }`}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full bg-surface border rounded-xl px-4 py-3 pr-11 text-slate-100 placeholder-slate-500 text-sm transition-colors outline-none focus:border-brand-500 ${
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
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
              <div className="text-right mt-1">
                <Link href="/auth/forgot-password" className="text-xs text-slate-500 hover:text-brand-400 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 glow-teal mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-card px-3 text-xs text-slate-500">ou continue com</span>
            </div>
          </div>

          {/* Google OAuth placeholder */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 glass hover:bg-surface-card text-slate-300 text-sm font-medium py-3 rounded-xl transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
