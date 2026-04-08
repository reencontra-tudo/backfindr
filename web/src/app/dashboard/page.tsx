'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package, CheckCircle2, Clock, AlertTriangle,
  Plus, ArrowRight, TrendingUp, QrCode, Zap
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { objectsApi, matchesApi, parseApiError } from '@/lib/api';
import { RegisteredObject, Match } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const STATUS_COLORS: Record<string, string> = {
  lost: 'text-red-400 bg-red-500/10 border-red-500/20',
  found: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  stolen: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', returned: 'Recuperado', stolen: 'Roubado',
};

function StatCard({
  icon, label, value, trend, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: string;
  color: string;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [objects, setObjects] = useState<RegisteredObject[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [objRes, matchRes] = await Promise.all([
          objectsApi.list({ size: 5 }),
          matchesApi.list(),
        ]);
        setObjects(objRes.data?.items ?? []);
        setMatches(matchRes.data?.items ?? []);
      } catch (err) {
        console.error(parseApiError(err));
        // Use empty state — not a crash
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = {
    total: objects.length,
    lost: objects.filter((o) => o.status === 'lost').length,
    returned: objects.filter((o) => o.status === 'returned').length,
    pending: matches.filter((m) => m.status === 'pending').length,
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] ?? 'usuário';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Aqui está um resumo dos seus objetos registrados.
          </p>
        </div>
        <Link
          href="/dashboard/objects/new"
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all glow-teal"
        >
          <Plus className="w-4 h-4" />
          Registrar objeto
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Package className="w-4 h-4 text-brand-400" />}
          label="Total de objetos"
          value={loading ? '—' : stats.total}
          color="bg-brand-500/10"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Perdidos ativos"
          value={loading ? '—' : stats.lost}
          color="bg-red-500/10"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          label="Recuperados"
          value={loading ? '—' : stats.returned}
          trend="+12%"
          color="bg-green-500/10"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-accent-yellow" />}
          label="Matches pendentes"
          value={loading ? '—' : stats.pending}
          color="bg-yellow-500/10"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent objects */}
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-white">Objetos recentes</h2>
            <Link
              href="/dashboard/objects"
              className="text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-surface-border/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : objects.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nenhum objeto registrado ainda.</p>
              <Link
                href="/dashboard/objects/new"
                className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 text-sm mt-2 transition-colors"
              >
                Registrar primeiro objeto <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {objects.map((obj) => (
                <Link
                  key={obj.id}
                  href={`/dashboard/objects/${obj.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-border flex items-center justify-center text-xl flex-shrink-0">
                    {CATEGORY_EMOJI[obj.category] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{obj.title}</p>
                    <p className="text-slate-500 text-xs">
                      {formatDistanceToNow(new Date(obj.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                      STATUS_COLORS[obj.status]
                    }`}
                  >
                    {STATUS_LABEL[obj.status]}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-4">
          {/* Pending matches */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-4 h-4 text-brand-400" />
              <h3 className="font-display font-semibold text-white text-sm">Matches pendentes</h3>
              {stats.pending > 0 && (
                <span className="ml-auto bg-brand-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {stats.pending}
                </span>
              )}
            </div>

            {matches.filter((m) => m.status === 'pending').length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">
                Nenhum match pendente
              </p>
            ) : (
              <div className="space-y-2">
                {matches
                  .filter((m) => m.status === 'pending')
                  .slice(0, 3)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 bg-surface rounded-lg">
                      <div>
                        <p className="text-white text-xs font-medium">Match #{m.id.slice(0, 8)}</p>
                        <p className="text-slate-500 text-xs">
                          {Math.round(m.confidence_score * 100)}% confiança
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/matches`}
                        className="text-brand-400 hover:text-brand-300 text-xs transition-colors"
                      >
                        Ver
                      </Link>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Quick tips */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-accent-yellow" />
              <h3 className="font-display font-semibold text-white text-sm">Dica rápida</h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Adicione fotos de alta qualidade aos seus objetos. A IA de matching é até{' '}
              <span className="text-brand-400 font-medium">3x mais precisa</span> com boas imagens.
            </p>
            <Link
              href="/dashboard/objects/new"
              className="inline-flex items-center gap-1 text-brand-400 text-xs mt-3 hover:text-brand-300 transition-colors"
            >
              Registrar agora <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
