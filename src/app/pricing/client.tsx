'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { Check, Zap, Building2, Gift, ArrowRight, Star, Shield, Globe, Clock, MapPin } from 'lucide-react';

interface Plan {
  slug: string;
  name: string;
  price_brl: number;
  max_objects: number;
  features: string[];
  is_active: boolean;
}

const DEFAULT_PLANS: Plan[] = [
  {
    slug: 'free',
    name: 'Grátis',
    price_brl: 0,
    max_objects: 3,
    features: ['3 objetos cadastrados', 'QR Code permanente', 'Busca manual na rede', 'Suporte da comunidade'],
    is_active: true,
  },
  {
    slug: 'pro',
    name: 'Pro',
    price_brl: 29.00,
    max_objects: 50,
    features: ['50 objetos cadastrados', 'Matching automático com IA', 'Notificações push e email', 'QR Code personalizado', 'Suporte por email', 'Relatório básico'],
    is_active: true,
  },
  {
    slug: 'business',
    name: 'Business',
    price_brl: 149.00,
    max_objects: 500,
    features: ['500 objetos cadastrados', 'Matching prioritário', 'Notificações push, email e SMS', 'QR Code bulk', '5 usuários na conta', 'Relatórios completos', 'Suporte prioritário', 'Acesso à API'],
    is_active: true,
  },
];

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free:     <Gift className="w-5 h-5" />,
  pro:      <Zap className="w-5 h-5" />,
  business: <Building2 className="w-5 h-5" />,
};

const PLAN_COLORS: Record<string, string> = {
  free:     'border-white/[0.08] bg-white/[0.02]',
  pro:      'border-teal-500/40 bg-teal-500/[0.04] ring-1 ring-teal-500/20',
  business: 'border-yellow-500/20 bg-yellow-500/[0.02]',
};

const PLAN_BADGE: Record<string, string | null> = {
  free:     null,
  pro:      'Mais popular',
  business: 'Para empresas',
};

const PLAN_ORDER: Record<string, number> = { free: 0, pro: 1, business: 2 };

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [testMode] = useState(false);
  const [currentUserPlan, setCurrentUserPlan] = useState<string | null>(null);

  // Detectar plano atual do usuário logado
  useEffect(() => {
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch('/api/v1/billing/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.plan) setCurrentUserPlan(data.plan); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/v1/plans')
      .then(r => r.json())
      .then(data => {
        if (data.plans?.length > 0) {
          // Normalizar price_brl para number (a API pode retornar como string)
          setPlans(data.plans.map((p: Plan) => ({ ...p, price_brl: parseFloat(String(p.price_brl)) })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectPlan(slug: string) {
    if (slug === 'free') {
      window.location.href = '/auth/register';
      return;
    }

    setSelectedPlan(slug);
    setCheckoutLoading(true);

    try {
      const token = typeof window !== 'undefined'
        ? Cookies.get('access_token')
        : null;

      if (!token) {
        window.location.href = `/auth/register?plan=${slug}`;
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
        alert(data.error || 'Erro ao criar checkout. Tente novamente.');
      }
    } catch {
      alert('Erro ao processar. Tente novamente.');
    } finally {
      setCheckoutLoading(false);
      setSelectedPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[15px]">Backfindr</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition-colors">
            Entrar
          </Link>
          <Link href="/auth/register" className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            Criar conta grátis
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-teal-500 text-xs uppercase tracking-[0.15em] font-semibold mb-4">Planos</p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simples e transparente
          </h1>
          <p className="text-white/40 text-lg max-w-md mx-auto">
            Comece grátis. Faça upgrade quando precisar de mais.
          </p>

          {testMode && (
            <div className="mt-5 inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 text-yellow-400 text-sm">
              <Shield className="w-4 h-4" />
              Modo de teste ativo — nenhuma cobrança será realizada
            </div>
          )}
        </div>

        {/* Cards de planos */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`relative rounded-2xl border p-6 flex flex-col ${PLAN_COLORS[plan.slug] || 'border-white/[0.08] bg-white/[0.02]'}`}
              >
                {PLAN_BADGE[plan.slug] && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${plan.slug === 'pro' ? 'bg-teal-500' : 'bg-yellow-500/80'}`}>
                      {PLAN_BADGE[plan.slug]}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${plan.slug === 'pro' ? 'bg-teal-500/20 text-teal-400' : plan.slug === 'business' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/50'}`}>
                      {PLAN_ICONS[plan.slug]}
                    </div>
                    <span className="font-semibold">{plan.name}</span>
                  </div>

                  <div className="flex items-baseline gap-1">
                    {plan.price_brl === 0 ? (
                      <span className="text-3xl font-bold">Grátis</span>
                    ) : (
                      <>
                        <span className="text-white/40 text-sm">R$</span>
                        <span className="text-3xl font-bold">{Number(plan.price_brl).toFixed(2).replace('.', ',')}</span>
                        <span className="text-white/30 text-sm">/mês</span>
                      </>
                    )}
                  </div>
                  <p className="text-white/30 text-xs mt-1">
                    Até {plan.max_objects.toLocaleString('pt-BR')} objetos
                  </p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.slug === 'pro' ? 'text-teal-400' : plan.slug === 'business' ? 'text-yellow-400' : 'text-white/40'}`} strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {(() => {
                    const isCurrentPlan = currentUserPlan === plan.slug;
                    const isDowngrade = currentUserPlan !== null && (PLAN_ORDER[plan.slug] ?? 0) < (PLAN_ORDER[currentUserPlan] ?? 0);
                    const isUpgrade = currentUserPlan !== null && (PLAN_ORDER[plan.slug] ?? 0) > (PLAN_ORDER[currentUserPlan] ?? 0);
                    if (isCurrentPlan) {
                      return (
                        <div className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-teal-500/30 bg-teal-500/10 text-teal-400 cursor-default">
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                          Plano atual
                        </div>
                      );
                    }
                    if (isDowngrade) {
                      return (
                        <div className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-white/[0.06] bg-white/[0.02] text-white/20 cursor-not-allowed">
                          Plano inferior
                        </div>
                      );
                    }
                    const btnLabel = plan.price_brl === 0
                      ? 'Começar grátis'
                      : isUpgrade
                      ? `Fazer upgrade para ${plan.name}`
                      : `Assinar ${plan.name}`;
                    return (
                      <button
                        onClick={() => handleSelectPlan(plan.slug)}
                        disabled={checkoutLoading && selectedPlan === plan.slug}
                        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          plan.slug === 'pro'
                            ? 'bg-teal-500 hover:bg-teal-400 text-white'
                            : plan.slug === 'business'
                            ? 'border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400'
                            : 'border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white'
                        }`}
                      >
                        {checkoutLoading && selectedPlan === plan.slug ? (
                          <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : (
                          <>
                            {btnLabel}
                            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                          </>
                        )}
                      </button>
                    );
                  })()}
              </div>
            ))}
          </div>
        )}

        {/* Boost Section */}
        <div className="border border-white/[0.08] rounded-2xl p-8 bg-white/[0.02] mb-14">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-2 bg-orange-500/20 rounded-xl text-orange-400 flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Boost — Destaque sua publicação</h2>
              <p className="text-white/40 text-sm">
                Seu item ainda não foi encontrado? Aumente as chances colocando sua publicação em destaque no mapa e no feed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Boost 7 dias',   price: 'R$ 9,90',  desc: 'Aparece no topo do mapa e feed por 7 dias' },
              { label: 'Boost 30 dias',  price: 'R$ 24,90', desc: 'Destaque por 30 dias + notificação para usuários próximos' },
              { label: 'Alerta de Área', price: 'R$ 14,90', desc: 'Notificação push para usuários num raio de 5 km' },
            ].map(boost => (
              <div key={boost.label} className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.03]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{boost.label}</span>
                  <span className="text-orange-400 font-bold text-sm">{boost.price}</span>
                </div>
                <p className="text-white/40 text-xs">{boost.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-white/25 text-xs mt-4 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            O Boost pode ser ativado diretamente na página do seu objeto no dashboard.
          </p>
        </div>

        {/* Garantias */}
        <div className="grid md:grid-cols-3 gap-6 text-center mb-14">
          {[
            { icon: <Shield className="w-5 h-5 text-teal-400" />, title: 'Cancele quando quiser', desc: 'Sem fidelidade. Cancele a qualquer momento pelo painel.' },
            { icon: <Zap className="w-5 h-5 text-teal-400" />, title: 'Ativação imediata', desc: 'Upgrade ativo em segundos após o pagamento.' },
            { icon: <Globe className="w-5 h-5 text-teal-400" />, title: 'Pagamento seguro', desc: 'Processado pelo Stripe ou Mercado Pago. Cartão e Pix.' },
          ].map(f => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                {f.icon}
              </div>
              <p className="font-medium text-sm">{f.title}</p>
              <p className="text-white/30 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div>
          <h3 className="text-lg font-semibold mb-6 text-center">Perguntas frequentes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { q: 'O QR Code expira?', a: 'Não. O QR Code é permanente em todos os planos. Se alguém encontrar seu item e escanear, você recebe o aviso independente do plano.' },
              { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem multa, sem burocracia. Ao cancelar, você continua com acesso até o fim do período pago.' },
              { q: 'O que acontece se eu atingir o limite de objetos?', a: 'Você não consegue cadastrar novos objetos até fazer upgrade ou remover objetos existentes.' },
              { q: 'O Boost é uma assinatura?', a: 'Não. O Boost é um pagamento único por período. Você escolhe quando ativar e por quanto tempo.' },
              { q: 'Posso pagar com Pix?', a: 'Sim. Aceitamos Pix via Mercado Pago para usuários brasileiros, além de cartão de crédito/débito via Stripe.' },
              { q: 'O plano Business aceita CNPJ?', a: 'Sim. O plano Business aceita tanto CPF quanto CNPJ e inclui nota fiscal mediante solicitação.' },
            ].map((item, i) => (
              <div key={i} className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02]">
                <p className="font-medium text-sm mb-1.5">{item.q}</p>
                <p className="text-white/40 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
