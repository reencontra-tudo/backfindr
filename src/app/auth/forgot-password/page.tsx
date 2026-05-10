'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, ArrowRight, Loader2, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const schema = z.object({ email: z.string().email('E-mail inválido') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      // Sempre mostrar sucesso por segurança (não revelar se email existe)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,184,166,0.07) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/60 text-sm transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar ao login
        </Link>

        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-7 h-7 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">E-mail enviado</h1>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.
            </p>
            <Link href="/auth/login" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" /> Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Recuperar senha</h1>
              <p className="text-white/40 text-sm">
                Digite seu e-mail e enviaremos um link de redefinição.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-[13px] text-white/50 mb-1.5">E-mail</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="seu@email.com"
                  className={`w-full bg-white/[0.04] border ${errors.email ? 'border-red-500/60' : 'border-white/[0.08]'} rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 transition-all`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Enviar link</span><ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
