'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, parseApiError } from '@/lib/api';

const inputClass = (err: boolean) =>
  `w-full bg-white/[0.04] border ${err ? 'border-red-500/60' : 'border-white/[0.08]'} rounded-lg px-3.5 py-2.5 text-white placeholder-white/20 text-sm outline-none focus:border-teal-500/60 transition-all`;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const passwordError = passwordTouched && password.length > 0 && password.length < 8 ? 'Mínimo 8 caracteres' : '';
  const confirmError = confirmTouched && confirm !== password ? 'Senhas não conferem' : '';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error('Token inválido'); return; }
    if (password.length < 8) { toast.error('A senha deve ter no mínimo 8 caracteres'); return; }
    if (password !== confirm) { toast.error('As senhas não conferem'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: password });
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 2500);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Link inválido</h1>
        <p className="text-white/40 text-sm mb-6">Este link de recuperação é inválido ou expirou.</p>
        <Link href="/auth/forgot-password" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
          Solicitar novo link →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-7 h-7 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Senha redefinida!</h1>
        <p className="text-white/40 text-sm">Redirecionando para o login...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Nova senha</h1>
        <p className="text-white/40 text-sm">Escolha uma senha forte para sua conta.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] text-white/50 mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              placeholder="Mínimo 8 caracteres"
              className={inputClass(!!passwordError) + ' pr-10'}
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
        </div>
        <div>
          <label className="block text-[13px] text-white/50 mb-1.5">Confirmar senha</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            placeholder="••••••••"
            className={inputClass(!!confirmError)}
          />
          {confirmError && <p className="text-red-400 text-xs mt-1">{confirmError}</p>}
        </div>
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4),0 4px 20px rgba(20,184,166,0.15)' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Redefinir senha</span><ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-5">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,184,166,0.07) 0%, transparent 70%)' }} />
      <div className="w-full max-w-sm relative z-10">
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
        <Suspense fallback={<div className="text-white/40 text-sm">Carregando...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
