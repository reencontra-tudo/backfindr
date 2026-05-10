'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Package, TrendingUp, QrCode, CheckCircle2,
  AlertCircle, Clock, BarChart3, ArrowRight, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuth';

interface BusinessStats {
  summary: {
    total_objects: number;
    recent_objects: number;
    total_matches: number;
    confirmed_matches: number;
    recovery_rate: number;
    scanned_objects: number;
  };
  by_status: Record<string, number>;
  by_category: { category: string; count: number }[];
  recent_objects: {
    id: string;
    title: string;
    status: string;
    category: string;
    created_at: string;
    scan_count: number;
    qr_code: string;
  }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  lost:     { label: 'Perdido',    color: 'text-red-400 bg-red-500/10 border-red-500/20',    icon: <AlertCircle className="w-3.5 h-3.5" /> },
  found:    { label: 'Achado',     color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  stolen:   { label: 'Furtado',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  returned: { label: 'Devolvido', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'text-white/40 bg-white/[0.06] border-white/[0.08]', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  );
}

export default function BusinessPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get('/business/stats');
      setStats(data);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  if (user?.plan !== 'business') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-teal-400" />
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">Painel Business</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs">
          Este painel está disponível apenas para assinantes do plano Business (R$ 149/mês).
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
        >
          Ver planos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const { summary, by_status, by_category, recent_objects } = stats;

  const summaryCards = [
    { label: 'Total de Ativos', value: summary.total_objects, icon: <Package className="w-5 h-5 text-teal-400" />, sub: `+${summary.recent_objects} nos últimos 30 dias` },
    { label: 'Taxa de Recuperação', value: `${summary.recovery_rate}%`, icon: <TrendingUp className="w-5 h-5 text-green-400" />, sub: `${summary.confirmed_matches} recuperações confirmadas` },
    { label: 'QR Codes Escaneados', value: summary.scanned_objects, icon: <QrCode className="w-5 h-5 text-blue-400" />, sub: `de ${summary.total_objects} ativos registrados` },
    { label: 'Matches Gerados', value: summary.total_matches, icon: <BarChart3 className="w-5 h-5 text-purple-400" />, sub: `${summary.confirmed_matches} confirmados pela IA` },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-xl flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            Painel Business
          </h1>
          <p className="text-white/30 text-sm mt-0.5">Gestão de ativos e analytics da sua conta</p>
        </div>
        <button
          onClick={() => loadStats(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-white/40 hover:text-white text-xs transition-colors border border-white/[0.08] px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                {card.icon}
              </div>
            </div>
            <p className="text-white font-bold text-2xl">{card.value}</p>
            <p className="text-white/40 text-xs mt-0.5">{card.label}</p>
            <p className="text-white/20 text-[11px] mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-4">Ativos por Status</h3>
          <div className="space-y-3">
            {Object.entries(by_status).length === 0 ? (
              <p className="text-white/30 text-sm">Nenhum dado disponível.</p>
            ) : (
              Object.entries(by_status).map(([status, count]) => {
                const pct = summary.total_objects > 0 ? Math.round((count / summary.total_objects) * 100) : 0;
                const s = STATUS_LABELS[status] ?? { label: status, color: 'text-white/40 bg-white/[0.06] border-white/[0.08]', icon: null };
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/60 text-xs flex items-center gap-1.5">
                        {s.icon}<span>{s.label}</span>
                      </span>
                      <span className="text-white/40 text-xs">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-4">Ativos por Categoria</h3>
          <div className="space-y-2">
            {by_category.length === 0 ? (
              <p className="text-white/30 text-sm">Nenhum dado disponível.</p>
            ) : (
              by_category.slice(0, 6).map(({ category, count }) => (
                <div key={category} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-white/60 text-sm capitalize">{category}</span>
                  <span className="text-white font-medium text-sm">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent objects */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium text-sm">Ativos Recentes</h3>
          <Link href="/dashboard/objects" className="text-teal-400 hover:text-teal-300 text-xs flex items-center gap-1 transition-colors">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recent_objects.length === 0 ? (
          <p className="text-white/30 text-sm">Nenhum objeto cadastrado ainda.</p>
        ) : (
          <div className="space-y-0">
            {recent_objects.map((obj, i) => (
              <div
                key={obj.id}
                className={`flex items-center gap-4 py-3 ${i < recent_objects.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{obj.title}</p>
                  <p className="text-white/30 text-xs capitalize">{obj.category || 'outro'} · {obj.scan_count} scans</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={obj.status} />
                  <Link
                    href={`/dashboard/objects/${obj.id}`}
                    className="text-white/20 hover:text-teal-400 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA para suporte */}
      <div className="bg-teal-500/[0.04] border border-teal-500/20 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white font-medium text-sm">Precisa de suporte ou integração via API?</p>
          <p className="text-white/40 text-xs mt-0.5">Seu plano Business inclui onboarding dedicado e SLA garantido.</p>
        </div>
        <a
          href="mailto:business@backfindr.com"
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0 ml-4"
        >
          Falar com suporte <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
