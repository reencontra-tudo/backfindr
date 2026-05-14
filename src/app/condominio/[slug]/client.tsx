'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2, Package, Search, Bell, QrCode,
  CheckCircle2, ArrowRight, Loader2, Eye, EyeOff, Users
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useBranding } from '@/hooks/useBranding';
import { api } from '@/lib/api';
import Cookies from 'js-cookie';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Condominio {
  id: string;
  nome: string;
  slug: string;
  endereco: string;
  cidade: string;
  estado: string;
  total_unidades: number;
  logo_url: string | null;
  banner_url: string | null;
  cor_primaria: string | null;
  cor_texto: string | null;
  mensagem_boas_vindas: string | null;
  moradores_cadastrados: number;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name:     z.string().min(3, 'Nome completo obrigatório'),
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  phone:    z.string().optional(),
  numero:   z.string().min(1, 'Número da unidade obrigatório'),
  bloco:    z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  numero:   z.string().min(1, 'Número da unidade obrigatório'),
  bloco:    z.string().optional(),
});

type RegisterData = z.infer<typeof registerSchema>;
type LoginData    = z.infer<typeof loginSchema>;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CondominioJoinClient({ condominio }: { condominio: Condominio }) {
  const router               = useRouter();
  const { styles, cor }      = useBranding(condominio);
  const { login, register: registerUser } = useAuthStore();
  const [mode, setMode]      = useState<'choose' | 'register' | 'login' | 'success'>('choose');
  const [showPass, setShowPass] = useState(false);
  const [joining, setJoining]  = useState(false);

  const pct = condominio.total_unidades > 0
    ? Math.round((condominio.moradores_cadastrados / condominio.total_unidades) * 100)
    : 0;

  // ── Vincular ao condomínio após autenticação ─────────────────────────────
  async function joinCondominio(numero: string, bloco?: string) {
    setJoining(true);
    try {
      await api.post(`/portaria/condominios/${condominio.slug}/join`, {
        numero,
        bloco: bloco || undefined,
      });
    } finally {
      setJoining(false);
    }
  }

  // ── Cadastro novo usuário ────────────────────────────────────────────────
  const {
    register: reg,
    handleSubmit: handleReg,
    formState: { errors: regErrors, isSubmitting: regLoading },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  const onRegister = async (data: RegisterData) => {
    try {
      await registerUser({ name: data.name, email: data.email, password: data.password, phone: data.phone });
      await joinCondominio(data.numero, data.bloco);
      setMode('success');
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Erro ao criar conta';
      toast.error(msg.includes('already exists') ? 'E-mail já cadastrado. Faça login.' : msg);
    }
  };

  // ── Login usuário existente ──────────────────────────────────────────────
  const {
    register: log,
    handleSubmit: handleLog,
    formState: { errors: logErrors, isSubmitting: logLoading },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  const onLogin = async (data: LoginData) => {
    try {
      await login(data.email, data.password);
      await joinCondominio(data.numero, data.bloco);
      setMode('success');
    } catch {
      toast.error('E-mail ou senha incorretos.');
    }
  };

  // ─── TELA: Sucesso ────────────────────────────────────────────────────────
  if (mode === 'success') {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-teal-500/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-teal-400" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold mb-2">Tudo certo!</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Você está cadastrado no{' '}
              <span className="text-white font-semibold">{condominio.nome}</span>.
              Agora você receberá alertas de encomendas e faz parte da rede de achados e perdidos do seu condomínio.
            </p>
          </div>
          <div className="space-y-2.5">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity" style={styles.button}
            >
              Ir para meu painel <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="flex items-center justify-center w-full py-3 text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── TELA: Escolher modo ─────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col">
        {/* Header */}
        <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-sm">📍</span>
            </div>
            <span className="text-white font-bold text-sm">Backfindr</span>
          </Link>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">

            {/* Info do condomínio */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto">
                {condominio.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={condominio.logo_url} alt={condominio.nome} className="w-10 h-10 object-contain rounded-xl" />
                ) : (
                  <Building2 className="w-8 h-8 text-white/40" />
                )}
              </div>
              <div>
                <h1 className="text-white text-xl font-bold">{condominio.nome}</h1>
                <p className="text-white/40 text-sm">{condominio.cidade}, {condominio.estado}</p>
              </div>
            </div>

            {/* Progresso de cadastros */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-white/50">
                  <Users className="w-4 h-4" />
                  <span>Moradores cadastrados</span>
                </div>
                <span className="text-white font-semibold">
                  {condominio.moradores_cadastrados} / {condominio.total_unidades}
                </span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: cor }}
                />
              </div>
              <p className="text-white/30 text-xs">
                {pct}% do condomínio já utiliza o Backfindr
              </p>
            </div>

            {/* Mensagem personalizada do condomínio */}
            {condominio.mensagem_boas_vindas && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/70 text-sm leading-relaxed italic">
                  "{condominio.mensagem_boas_vindas}"
                </p>
              </div>
            )}

            {/* Benefícios */}
            <div className="space-y-2.5">
              {[
                { icon: <Package className="w-4 h-4 text-teal-400" />, text: 'Alerta quando uma encomenda chegar na portaria' },
                { icon: <Search className="w-4 h-4 text-teal-400" />, text: 'Rede de achados e perdidos do seu condomínio' },
                { icon: <Bell className="w-4 h-4 text-teal-400" />, text: 'Notificações via WhatsApp e push' },
                { icon: <QrCode className="w-4 h-4 text-teal-400" />, text: 'QR Code para proteger seus objetos' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-white/60">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cor}18` }}>
                    {b.icon}
                  </div>
                  {b.text}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setMode('register')}
                className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2" style={styles.button}
              >
                Criar minha conta <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode('login')}
                className="w-full py-3 border border-white/[0.10] hover:border-white/20 rounded-xl text-white/60 hover:text-white text-sm font-semibold transition-colors"
              >
                Já tenho conta — fazer login
              </button>
            </div>

            <p className="text-white/20 text-xs text-center">
              Gratuito · Dados protegidos pela LGPD
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── TELA: Cadastro / Login ───────────────────────────────────────────────
  const isRegister = mode === 'register';

  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <button
          onClick={() => setMode('choose')}
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-white/30" />
          <span className="text-white/40 text-sm truncate max-w-[160px]">{condominio.nome}</span>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">

          <div>
            <h2 className="text-white text-xl font-bold mb-1">
              {isRegister ? 'Criar minha conta' : 'Entrar na minha conta'}
            </h2>
            <p className="text-white/40 text-sm">
              {isRegister
                ? 'Depois vinculamos você ao condomínio automaticamente.'
                : 'Faça login e vincularemos sua conta ao condomínio.'}
            </p>
          </div>

          {/* Unidade — campo em destaque no topo */}
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 space-y-3">
            <p className="text-teal-300 text-xs font-semibold uppercase tracking-wider">
              Sua unidade em {condominio.nome}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                {isRegister ? (
                  <>
                    <input
                      {...reg('numero')}
                      placeholder="Nº do apartamento"
                      className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.10] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/50"
                    />
                    {regErrors.numero && <p className="text-red-400 text-xs mt-1">{regErrors.numero.message}</p>}
                  </>
                ) : (
                  <>
                    <input
                      {...log('numero')}
                      placeholder="Nº do apartamento"
                      className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.10] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/50"
                    />
                    {logErrors.numero && <p className="text-red-400 text-xs mt-1">{logErrors.numero.message}</p>}
                  </>
                )}
              </div>
              <div className="w-24">
                <input
                  {...(isRegister ? reg('bloco') : log('bloco'))}
                  placeholder="Bloco"
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.10] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>
          </div>

          {/* Formulário */}
          {isRegister ? (
            <form onSubmit={handleReg(onRegister)} className="space-y-3">
              <div>
                <input
                  {...reg('name')}
                  placeholder="Nome completo"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40"
                />
                {regErrors.name && <p className="text-red-400 text-xs mt-1">{regErrors.name.message}</p>}
              </div>
              <div>
                <input
                  {...reg('email')}
                  type="email"
                  placeholder="E-mail"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40"
                />
                {regErrors.email && <p className="text-red-400 text-xs mt-1">{regErrors.email.message}</p>}
              </div>
              <div>
                <input
                  {...reg('phone')}
                  type="tel"
                  placeholder="WhatsApp (opcional)"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40"
                />
              </div>
              <div className="relative">
                <input
                  {...reg('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Senha (mínimo 8 caracteres)"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40 pr-10"
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {regErrors.password && <p className="text-red-400 text-xs mt-1">{regErrors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={regLoading || joining}
                className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2" style={styles.button}
              >
                {(regLoading || joining) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Cadastrando…</>
                ) : (
                  <>Criar conta e entrar <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLog(onLogin)} className="space-y-3">
              <div>
                <input
                  {...log('email')}
                  type="email"
                  placeholder="E-mail"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40"
                />
                {logErrors.email && <p className="text-red-400 text-xs mt-1">{logErrors.email.message}</p>}
              </div>
              <div className="relative">
                <input
                  {...log('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Senha"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-teal-500/40 pr-10"
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-3 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={logLoading || joining}
                className="w-full py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2" style={styles.button}
              >
                {(logLoading || joining) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Entrando…</>
                ) : (
                  <>Entrar e vincular <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <Link href="/auth/forgot-password" className="block text-center text-white/30 hover:text-white/50 text-xs transition-colors">
                Esqueci minha senha
              </Link>
            </form>
          )}

          <button
            onClick={() => setMode(isRegister ? 'login' : 'register')}
            className="w-full text-center text-white/30 hover:text-white/50 text-xs transition-colors"
          >
            {isRegister ? 'Já tenho conta — fazer login' : 'Não tenho conta — criar agora'}
          </button>

        </div>
      </div>
    </div>
  );
}
