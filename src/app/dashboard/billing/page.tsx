'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Zap, ArrowRight, Loader2, Star, CreditCard,
  Calendar, AlertTriangle, Building2, Gift, Clock, Shield,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BillingData {
  plan: string;
  plan_expires_at: string | null;
  provider: 'mercadopago' | 'stripe' | null;
  subscription_id: string | null;
  is_cancelled: boolean;
  subscription_history: Array<{
    provider: string;
    plan_id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    created_at: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLAN_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; price: string }> = {
  free:     { label: 'Gratuito',  icon: <Gift className="w-5 h-5" />,      color: 'text-white/60',   price: 'R$ 0/mês' },
  pro:      { label: 'Pro',       icon: <Zap className="w-5 h-5" />,       color: 'text-teal-400',   price: 'R$ 29,90/mês' },
  business: { label: 'Business',  icon: <Building2 className="w-5 h-5" />, color: 'text-yellow-400', price: 'R$ 149,90/mês' },
};

const PROVIDER_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  stripe:      'Stripe',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativo',     color: 'text-green-400' },
  cancelled: { label: 'Cancelado', color: 'text-red-400' },
  expired:   { label: 'Expirado',  color: 'text-white/40' },
  pending:   { label: 'Pendente',  color: 'text-yellow-400' },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ─── Main content ─────────────────────────────────────────────────────────────
function BillingContent() {
  const { fetchMe } = useAuthStore();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const fetchBilling = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;
    fetch('/api/v1/billing', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setBilling(data.data || data))
      .catch(() => toast.error('Erro ao carregar dados de cobrança'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (searchParams.get('success') === 'true' || searchParams.get('type') === 'plan') {
      toast.success('Upgrade realizado com sucesso! Bem-vindo ao Pro 🎉');
      fetchMe();
    }
    fetchBilling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async (planSlug: string) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) { window.location.href = '/auth/login'; return; }
    setUpgradeLoading(planSlug);
    try {
      const res = await fetch('/api/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'upgrade', plan_slug: planSlug }),
      });
      const data = await res.json();
      const url = data.data?.url || data.url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error(data.error || 'Erro ao iniciar checkout');
      }
    } catch {
      toast.error('Erro ao processar. Tente novamente.');
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleCancel = async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;
    setCancelLoading(true);
    try {
      const res = await fetch('/api/v1/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Assinatura cancelada. Você terá acesso até o fim do período pago.');
        setShowCancelConfirm(false);
        fetchBilling();
        fetchMe();
      } else {
        toast.error(data.error || 'Erro ao cancelar assinatura');
      }
    } catch {
      toast.error('Erro ao cancelar. Tente novamente.');
    } finally {
      setCancelLoading(false);
    }
  };

  const planCfg = PLAN_CONFIG[billing?.plan || 'free'] || PLAN_CONFIG.free;
  const isPaid = billing?.plan && billing.plan !== 'free';
  const isActive = isPaid && !billing?.is_cancelled;

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-white/[0.06] rounded-xl animate-pulse" />
        <div className="h-40 bg-white/[0.03] rounded-2xl animate-pulse" />
        <div className="h-32 bg-white/[0.03] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Plano e Cobrança</h1>
        <p className="text-white/40 text-sm mt-0.5">Gerencie sua assinatura e histórico de pagamentos</p>
      </div>

      {/* Plano atual */}
      <div className={`border rounded-2xl p-6 mb-5 ${
        billing?.plan === 'business' ? 'border-yellow-500/30 bg-yellow-500/[0.03]' :
        billing?.plan === 'pro'      ? 'border-teal-500/30 bg-teal-500/[0.04]' :
                                       'border-white/[0.08] bg-white/[0.02]'
      }`}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              billing?.plan === 'pro'      ? 'bg-teal-500/20 text-teal-400' :
              billing?.plan === 'business' ? 'bg-yellow-500/20 text-yellow-400' :
                                             'bg-white/[0.06] text-white/40'
            }`}>
              {planCfg.icon}
            </div>
            <div>
              <p className={`font-semibold text-base ${planCfg.color}`}>
                Plano {planCfg.label}
              </p>
              <p className="text-white/40 text-xs mt-0.5">{planCfg.price}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            isActive              ? 'bg-green-500/10 text-green-400 border-green-500/20' :
            billing?.is_cancelled ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    'bg-white/[0.06] text-white/40 border-white/[0.08]'
          }`}>
            {isActive ? 'Ativo' : billing?.is_cancelled ? 'Cancelado' : 'Gratuito'}
          </span>
        </div>

        {/* Detalhes da assinatura */}
        {isPaid && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/40 text-xs">
                  {billing?.is_cancelled ? 'Acesso até' : 'Renova em'}
                </span>
              </div>
              <p className="text-white text-sm font-medium">
                {formatDate(billing?.plan_expires_at || null)}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/40 text-xs">Provedor</span>
              </div>
              <p className="text-white text-sm font-medium">
                {billing?.provider ? PROVIDER_LABEL[billing.provider] : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Aviso de cancelamento */}
        {billing?.is_cancelled && billing.plan_expires_at && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs">
              Sua assinatura foi cancelada. Você terá acesso ao plano {planCfg.label} até {formatDate(billing.plan_expires_at)}.
            </p>
          </div>
        )}

        {/* Ações para plano pago ativo */}
        {isActive && !showCancelConfirm && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.06] hover:border-red-500/20 hover:bg-red-500/5 text-white/40 hover:text-red-400 text-sm transition-all"
          >
            <span>Cancelar assinatura</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Confirmação de cancelamento */}
        {showCancelConfirm && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
            <p className="text-white text-sm font-medium mb-1">Confirmar cancelamento?</p>
            <p className="text-white/40 text-xs mb-4">
              Você continuará com acesso ao plano {planCfg.label} até {formatDate(billing?.plan_expires_at || null)}.
              Após essa data, sua conta voltará para o plano Gratuito.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-50"
              >
                {cancelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sim, cancelar'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-white/[0.08] text-white/50 hover:text-white text-sm transition-all"
              >
                Manter plano
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade CTA — apenas para free ou cancelado */}
      {(!isPaid || billing?.is_cancelled) && (
        <div className="border border-teal-500/20 bg-teal-500/[0.03] rounded-2xl p-6 mb-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Fazer upgrade</p>
              <p className="text-white/40 text-sm">
                {billing?.is_cancelled
                  ? 'Reative sua assinatura para continuar com todos os recursos.'
                  : 'Desbloqueie IA de matching, notificações push e muito mais.'}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { slug: 'pro',      label: 'Pro',      price: 'R$ 29,90/mês',  desc: '50 objetos · IA · Notificações · Suporte por email', color: 'teal' },
              { slug: 'business', label: 'Business', price: 'R$ 149,90/mês', desc: '500 objetos · Prioritário · 5 usuários · API',        color: 'yellow' },
            ].map(plan => (
              <button
                key={plan.slug}
                onClick={() => handleUpgrade(plan.slug)}
                disabled={!!upgradeLoading}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-60 ${
                  plan.color === 'teal'
                    ? 'border-teal-500/30 bg-teal-500/[0.06] hover:bg-teal-500/10 text-teal-300'
                    : 'border-yellow-500/20 bg-yellow-500/[0.04] hover:bg-yellow-500/[0.08] text-yellow-300'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm">{plan.label}</p>
                  <p className="text-xs opacity-60 mt-0.5">{plan.desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-sm">{plan.price}</span>
                  {upgradeLoading === plan.slug
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ArrowRight className="w-4 h-4 opacity-60" />
                  }
                </div>
              </button>
            ))}
          </div>
          <p className="text-white/20 text-xs text-center mt-3 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            Pagamento seguro via Mercado Pago · Cancele quando quiser
          </p>
        </div>
      )}

      {/* Histórico de assinaturas */}
      {billing?.subscription_history && billing.subscription_history.length > 0 && (
        <div className="border border-white/[0.08] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Histórico de assinaturas</h3>
            <button
              onClick={fetchBilling}
              className="text-white/30 hover:text-white/60 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {billing.subscription_history.map((sub, i) => {
              const statusCfg = STATUS_LABEL[sub.status] || { label: sub.status, color: 'text-white/40' };
              const planLabel = PLAN_CONFIG[sub.plan_id]?.label || sub.plan_id;
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">Plano {planLabel}</p>
                    <p className="text-white/30 text-xs mt-0.5">
                      {PROVIDER_LABEL[sub.provider] || sub.provider} · {formatDate(sub.current_period_start)}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Garantias */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: <Shield className="w-4 h-4 text-teal-400" />, label: 'Cancele quando quiser' },
          { icon: <Zap className="w-4 h-4 text-teal-400" />,    label: 'Ativação imediata' },
          { icon: <Clock className="w-4 h-4 text-teal-400" />,  label: 'Sem fidelidade' },
        ].map(f => (
          <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl text-center">
            {f.icon}
            <p className="text-white/50 text-xs">{f.label}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="flex items-center justify-between text-sm">
        <Link href="/pricing" className="text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1">
          Ver todos os planos
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <a
          href="mailto:suporte@backfindr.com?subject=Dúvida sobre cobrança"
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          Falar com suporte
        </a>
      </div>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="p-8 max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-white/[0.06] rounded-xl animate-pulse" />
        <div className="h-40 bg-white/[0.03] rounded-2xl animate-pulse" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
