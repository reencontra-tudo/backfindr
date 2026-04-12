'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Check, Zap, Shield, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

const PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    period: 'para sempre',
    description: 'Para uso pessoal básico',
    color: 'border-white/[0.08]',
    features: [
      'Até 3 objetos registrados',
      'QR Code único por objeto',
      'Notificação por e-mail',
      'Mapa público',
      'Chat mediado básico',
    ],
    limits: [
      'Sem matching por IA',
      'Sem suporte prioritário',
    ],
    cta: 'Começar grátis',
    href: '/auth/register',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.90,
    period: 'por mês',
    description: 'Para quem leva a sério',
    color: 'border-teal-500/40',
    highlight: true,
    features: [
      'Objetos ilimitados',
      'IA de matching automático',
      'Notificações push em tempo real',
      'Chat mediado ilimitado',
      'QR Code premium (sem marca)',
      'Histórico completo',
      'Suporte prioritário',
      'API access (em breve)',
    ],
    cta: 'Assinar Pro',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    period: 'por mês',
    description: 'Para empresas e parceiros',
    color: 'border-white/[0.08]',
    features: [
      'Tudo do Pro',
      'Até 10 usuários',
      'Painel administrativo B2B',
      'Logística estruturada de devoluções',
      'Relatórios e analytics',
      'Integração via API',
      'SLA garantido',
      'Onboarding dedicado',
    ],
    cta: 'Falar com vendas',
    href: 'mailto:business@backfindr.com',
  },
];

export default function PricingPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleProCheckout = async () => {
    if (!isAuthenticated) {
      window.location.href = '/auth/register?next=/pricing';
      return;
    }
    setLoading('pro');
    try {
      const { data } = await api.post('/billing/create-checkout', {
        price_id: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
        success_url: `${window.location.origin}/dashboard/billing?success=true`,
        cancel_url: `${window.location.origin}/pricing`,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[15px]">Backfindr</span>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard" className="text-sm text-white/50 hover:text-white transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors">
              Entrar
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-teal-500 text-xs uppercase tracking-[0.15em] font-semibold mb-4">Planos</p>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
            Simples e transparente
          </h1>
          <p className="text-white/40 text-lg max-w-md mx-auto">
            Comece grátis. Faça upgrade quando precisar de mais.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative border rounded-2xl p-6 flex flex-col ${plan.color} ${
                plan.highlight
                  ? 'bg-teal-500/[0.04]'
                  : 'bg-white/[0.02]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Mais popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-white font-semibold mb-1">{plan.name}</p>
                <p className="text-white/30 text-xs mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-white">Grátis</span>
                  ) : (
                    <>
                      <span className="text-sm text-white/40">R$</span>
                      <span className="text-3xl font-bold text-white">
                        {plan.price.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-white/30 text-sm">/{plan.period}</span>
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="text-white/70">{f}</span>
                  </li>
                ))}
                {plan.limits?.map(l => (
                  <li key={l} className="flex items-start gap-2.5 text-sm">
                    <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center text-white/20 text-xs leading-4">✕</span>
                    <span className="text-white/25">{l}</span>
                  </li>
                ))}
              </ul>

              {plan.id === 'pro' ? (
                <button
                  onClick={handleProCheckout}
                  disabled={loading === 'pro' || user?.plan === 'pro'}
                  className={`w-full flex items-center justify-center gap-2 font-semibold py-2.5 rounded-lg transition-all text-sm ${
                    user?.plan === 'pro'
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 cursor-default'
                      : 'bg-teal-500 hover:bg-teal-400 text-white'
                  }`}
                  style={user?.plan !== 'pro' ? { boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' } : {}}
                >
                  {loading === 'pro' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : user?.plan === 'pro' ? (
                    '✓ Plano atual'
                  ) : (
                    <>{plan.cta} <ArrowRight className="w-4 h-4" strokeWidth={2.5} /></>
                  )}
                </button>
              ) : plan.href ? (
                <Link
                  href={plan.href}
                  className="w-full flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white font-medium py-2.5 rounded-lg transition-all text-sm"
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </Link>
              ) : null}
            </div>
          ))}
        </div>

        {/* Features comparison note */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: <Shield className="w-5 h-5 text-teal-400" />, title: 'Cancele quando quiser', desc: 'Sem fidelidade. Cancele a qualquer momento pelo painel.' },
            { icon: <Zap className="w-5 h-5 text-teal-400" />, title: 'Ativação imediata', desc: 'Upgrade ativo em segundos após o pagamento.' },
            { icon: <Globe className="w-5 h-5 text-teal-400" />, title: 'Pagamento seguro', desc: 'Processado pelo Stripe. Aceitamos cartão e Pix.' },
          ].map(f => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                {f.icon}
              </div>
              <p className="text-white font-medium text-sm">{f.title}</p>
              <p className="text-white/30 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
