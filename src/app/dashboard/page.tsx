'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, CheckCircle2, AlertTriangle,
  Plus, ArrowRight, Zap, QrCode, Star, CreditCard
} from 'lucide-react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/hooks/useAuth';
import { objectsApi, matchesApi, parseApiError } from '@/lib/api';
import { RegisteredObject, Match } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import OnboardingChecklist from '@/components/ui/OnboardingChecklist';

const EMOJI: Record<string, string> = {
  phone:'📱',wallet:'👛',keys:'🔑',bag:'🎒',pet:'🐾',
  bike:'🚲',document:'📄',jewelry:'💍',electronics:'💻',clothing:'👕',other:'📦',
};

const STATUS_COLOR: Record<string, string> = {
  lost:'text-red-400 bg-red-500/10 border-red-500/20',
  found:'text-teal-400 bg-teal-500/10 border-teal-500/20',
  returned:'text-green-400 bg-green-500/10 border-green-500/20',
  stolen:'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  lost:'Perdido',found:'Achado',returned:'Recuperado',stolen:'Roubado',
};

const PLAN_LABEL: Record<string, string> = {
  free: 'Grátis',
  pro: 'Pro',
  business: 'Business',
};

const PLAN_COLOR: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  free:     { bg: 'bg-white/[0.03]',      border: 'border-white/[0.07]',    text: 'text-white/50',  icon: 'text-white/30' },
  pro:      { bg: 'bg-teal-500/[0.06]',   border: 'border-teal-500/20',     text: 'text-teal-300',  icon: 'text-teal-400' },
  business: { bg: 'bg-yellow-500/[0.06]', border: 'border-yellow-500/20',   text: 'text-yellow-300',icon: 'text-yellow-400' },
};

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number|string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

interface PlanInfo {
  plan: string;
  is_paid: boolean;
  plan_expires_at: string | null;
  features?: { max_objects: number };
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

  // Buscar status do plano
  useEffect(() => {
    const token = Cookies.get('access_token');
    if (!token) return;
    fetch('/api/v1/billing/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setPlanInfo(data.data); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [objRes, matchRes] = await Promise.all([
        objectsApi.list({ size: 5 }),
        matchesApi.list(),
      ]);
      setObjects(objRes.data?.items ?? []);
      setMatches(matchRes.data?.matches ?? []);
    } catch (e) { console.error(parseApiError(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] ?? '';

  const lost = objects.filter(o => o.status === 'lost').length;
  const returned = objects.filter(o => o.status === 'returned').length;
  const pending = matches.filter(m => m.status === 'pending').length;

  const currentPlan = planInfo?.plan ?? user?.plan ?? 'free';
  const planColors = PLAN_COLOR[currentPlan] ?? PLAN_COLOR['free'];
  const isPaid = planInfo?.is_paid ?? false;

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="text-white/40 text-sm mt-0.5">Aqui está um resumo dos seus objetos.</p>
        </div>
        <Link
          href="/dashboard/objects/new"
          className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0"
          style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4)' }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Registrar
        </Link>
      </div>

      {/* Card de plano ativo */}
      <Link href="/dashboard/billing"
        className={`flex items-center justify-between gap-3 ${planColors.bg} border ${planColors.border} rounded-xl px-4 py-3 mb-6 hover:opacity-90 transition-all`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${planColors.bg} border ${planColors.border}`}>
            {currentPlan === 'free'
              ? <CreditCard className={`w-4 h-4 ${planColors.icon}`} />
              : <Star className={`w-4 h-4 ${planColors.icon}`} />
            }
          </div>
          <div>
            <p className={`text-sm font-semibold ${planColors.text}`}>
              Plano {PLAN_LABEL[currentPlan] ?? currentPlan}
              {isPaid && <span className="ml-2 text-xs font-normal opacity-70">ativo</span>}
            </p>
            {currentPlan === 'free' ? (
              <p className="text-white/30 text-xs">Faça upgrade para mais recursos</p>
            ) : planInfo?.plan_expires_at ? (
              <p className="text-white/30 text-xs">
                Renova em {new Date(planInfo.plan_expires_at).toLocaleDateString('pt-BR')} · até {planInfo?.features?.max_objects ?? '—'} objetos
              </p>
            ) : (
              <p className="text-white/30 text-xs">
                Até {planInfo?.features?.max_objects ?? '—'} objetos registrados
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {currentPlan === 'free' && (
            <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full">
              Upgrade
            </span>
          )}
          <ArrowRight className={`w-4 h-4 ${planColors.icon}`} />
        </div>
      </Link>

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingChecklist
          objectsCount={objects.length}
          objectStatuses={objects.map(o => o.status)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {/* Matches alert */}
      {pending > 0 && (
        <Link href="/dashboard/matches"
          className="flex items-center justify-between gap-3 bg-teal-500/[0.06] border border-teal-500/20 rounded-xl px-4 py-3 mb-6 hover:border-teal-500/40 transition-all">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span className="text-teal-300 text-sm font-medium">
              {pending} match{pending > 1 ? 'es' : ''} pendente{pending > 1 ? 's' : ''} — confirme para iniciar o chat
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-teal-400 flex-shrink-0" />
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={<Package className="w-4 h-4 text-white/60" />}
          label="Total registrados"
          value={loading ? '—' : objects.length}
          color="bg-white/[0.06]"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Perdidos ativos"
          value={loading ? '—' : lost}
          color="bg-red-500/10"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          label="Recuperados"
          value={loading ? '—' : returned}
          color="bg-green-500/10"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          label="Matches IA"
          value={loading ? '—' : pending}
          sub="aguardando avaliação"
          color="bg-yellow-500/10"
        />
      </div>

      {/* Recent objects */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">Objetos recentes</h2>
          <Link href="/dashboard/objects" className="text-teal-400 hover:text-teal-300 text-xs transition-colors flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />)}
          </div>
        ) : objects.length === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <p className="text-3xl mb-3">📦</p>
            <p className="text-white font-semibold mb-1">Nenhum objeto ainda</p>
            <p className="text-white/40 text-sm mb-4">Registre seu primeiro objeto e receba um QR Code exclusivo.</p>
            <Link href="/dashboard/objects/new"
              className="inline-flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
              <Plus className="w-4 h-4" /> Registrar primeiro objeto
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {objects.map(obj => (
              <Link key={obj.id} href={`/dashboard/objects/${obj.id}`}
                className="flex items-center gap-3 p-3.5 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-xl flex-shrink-0">
                  {EMOJI[obj.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate group-hover:text-teal-300 transition-colors">
                    {obj.title}
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {formatDistanceToNow(new Date(obj.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLOR[obj.status]}`}>
                  {STATUS_LABEL[obj.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/search"
          className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-white/40" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Buscar achados</p>
            <p className="text-white/30 text-xs">Pesquisar objetos encontrados</p>
          </div>
        </Link>
        <Link href="/map"
          className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all group">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <QrCode className="w-4 h-4 text-white/40" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Mapa público</p>
            <p className="text-white/30 text-xs">Ver objetos na região</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
