'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Zap, ArrowRight, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';
import { Suspense } from 'react';

interface BillingStatus {
  plan: string;
  is_pro: boolean;
  features: {
    max_objects: number;
    ai_matching: boolean;
    push_notifications: boolean;
    priority_support: boolean;
  };
}

function BillingContent() {
  const { user, fetchMe } = useAuthStore();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    // Success redirect from Stripe
    if (searchParams.get('success') === 'true') {
      toast.success('Upgrade realizado com sucesso! Bem-vindo ao Pro 🎉');
      fetchMe();
    }

    api.get('/billing/status')
      .then(({ data }) => setStatus(data))
      .catch(e => toast.error(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { data } = await api.post('/api/stripe/checkout', {
        price_id: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
        success_url: `${window.location.origin}/dashboard/billing?success=true`,
        cancel_url: `${window.location.origin}/dashboard/billing`,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Plano e Cobrança</h1>
        <p className="text-white/40 text-sm mt-0.5">Gerencie sua assinatura</p>
      </div>

      {/* Current plan */}
      {loading ? (
        <div className="h-32 bg-white/[0.03] rounded-2xl animate-pulse mb-6" />
      ) : (
        <div className={`border rounded-2xl p-6 mb-6 ${status?.is_pro ? 'border-teal-500/30 bg-teal-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {status?.is_pro && <Star className="w-4 h-4 text-yellow-400" />}
                <p className="text-white font-semibold">
                  Plano {status?.is_pro ? 'Pro' : 'Gratuito'}
                </p>
              </div>
              <p className="text-white/40 text-sm">
                {status?.is_pro
                  ? 'Você tem acesso a todos os recursos premium'
                  : `Usando ${status?.features.max_objects === -1 ? '∞' : status?.features.max_objects} objetos máximos`
                }
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${status?.is_pro ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-white/[0.06] text-white/50 border border-white/[0.08]'}`}>
              {status?.is_pro ? 'Pro' : 'Free'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Objetos', value: status?.features.max_objects === -1 ? 'Ilimitados' : `Até ${status?.features.max_objects}` },
              { label: 'IA de matching', value: status?.features.ai_matching ? 'Ativo' : 'Inativo' },
              { label: 'Push notifications', value: status?.features.push_notifications ? 'Ativo' : 'Inativo' },
              { label: 'Suporte prioritário', value: status?.features.priority_support ? 'Ativo' : 'Inativo' },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <span className="text-white/50 text-xs">{f.label}</span>
                <span className={`text-xs font-medium ${f.value === 'Inativo' ? 'text-white/20' : 'text-white'}`}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade CTA */}
      {!status?.is_pro && (
        <div className="border border-teal-500/20 bg-teal-500/[0.04] rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Upgrade para Pro</p>
              <p className="text-white/40 text-sm">Objetos ilimitados, IA de matching e notificações push por R$19,90/mês</p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
          >
            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" />Assinar Pro — R$19,90/mês</>}
          </button>
          <p className="text-white/20 text-xs text-center mt-2">Cancele quando quiser · Pagamento seguro via Stripe</p>
        </div>
      )}

      {/* Pro actions */}
      {status?.is_pro && (
        <div className="border border-white/[0.08] rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Gerenciar assinatura</h3>
          <div className="space-y-2">
            <a href="mailto:suporte@backfindr.com?subject=Cancelar assinatura"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-all">
              <span className="text-white/60 text-sm">Cancelar assinatura</span>
              <ArrowRight className="w-4 h-4 text-white/30" />
            </a>
            <a href="mailto:suporte@backfindr.com?subject=Atualizar dados de pagamento"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-all">
              <span className="text-white/60 text-sm">Atualizar cartão</span>
              <ArrowRight className="w-4 h-4 text-white/30" />
            </a>
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link href="/pricing" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
          Ver todos os planos →
        </Link>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/40">Carregando...</div>}>
      <BillingContent />
    </Suspense>
  );
}
