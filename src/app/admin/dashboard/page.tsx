'use client';

import { useEffect, useState } from 'react';
import { Users, Package, Zap, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, MapPin, QrCode, CheckCircle2, AlertTriangle, Clock, Share2, MousePointerClick, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  total_users: number; new_users_today: number; new_users_week: number;
  total_objects: number; lost_objects: number; found_objects: number; returned_objects: number;
  pending_matches: number; confirmed_matches: number; rejected_matches: number;
  total_scans_today: number; active_users_week: number;
}

interface Activity { id: string; type: string; text: string; time: string; }
interface GeoItem { city: string; pct: number; }

const FALLBACK: Stats = {
  total_users: 0, new_users_today: 0, new_users_week: 0,
  total_objects: 0, lost_objects: 0, found_objects: 0, returned_objects: 0,
  pending_matches: 0, confirmed_matches: 0, rejected_matches: 0,
  total_scans_today: 0, active_users_week: 0,
};

function KPI({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  user: Users, object: Package, match: Zap, scan: QrCode, returned: CheckCircle2,
};
const ACTIVITY_COLORS: Record<string, string> = {
  user: 'text-blue-400 bg-blue-500/10', object: 'text-teal-400 bg-teal-500/10',
  match: 'text-yellow-400 bg-yellow-500/10', scan: 'text-purple-400 bg-purple-500/10',
  returned: 'text-green-400 bg-green-500/10',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [geoData, setGeoData] = useState<GeoItem[]>([]);

  useEffect(() => {
    // Stats reais do banco
    fetch('/api/v1/admin/stats')
      .then(r => r.json())
      .then(data => setStats({ ...FALLBACK, ...data }))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Atividade recente real
    fetch('/api/v1/admin/activity')
      .then(r => r.json())
      .then(data => setActivities(data.items ?? []))
      .catch(() => {});
    // Concentração geográfica real
    fetch('/api/v1/admin/geo')
      .then(r => r.json())
      .then(data => setGeoData(data.items ?? []))
      .catch(() => {});
  }, []);

  const recoveryRate = stats.total_objects > 0
    ? ((stats.returned_objects / stats.total_objects) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-white/30 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Sistema operacional</span>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Users}       label="Total usuários"      value={stats.total_users}       sub={`+${stats.new_users_week} esta semana`}   color="text-blue-400 bg-blue-500/10"   trend="up" />
        <KPI icon={Package}     label="Total objetos"       value={stats.total_objects}     sub={`${stats.lost_objects} perdidos ativos`}  color="text-teal-400 bg-teal-500/10"   trend="up" />
        <KPI icon={Zap}         label="Matches pendentes"   value={stats.pending_matches}   sub={`${stats.confirmed_matches} confirmados`} color="text-yellow-400 bg-yellow-500/10" trend={stats.pending_matches > 10 ? 'up' : null} />
        <KPI icon={TrendingUp}  label="Taxa recuperação"    value={`${recoveryRate}%`}      sub={`${stats.returned_objects} objetos`}      color="text-green-400 bg-green-500/10"  trend="up" />
      </div>

      {/* Secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Activity}     label="Scans hoje"          value={stats.total_scans_today}  color="text-purple-400 bg-purple-500/10" />
        <KPI icon={Users}        label="Ativos esta semana"  value={stats.active_users_week}  color="text-white/50 bg-white/[0.06]" />
        <KPI icon={CheckCircle2} label="Matches confirmados" value={stats.confirmed_matches}  color="text-green-400 bg-green-500/10" />
        <KPI icon={AlertTriangle} label="Objetos achados"    value={stats.found_objects}      color="text-orange-400 bg-orange-500/10" />
      </div>

      {/* Status bar */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Distribuição de objetos</p>
        <div className="space-y-3">
          {[
            { label: 'Perdidos',    value: stats.lost_objects,     total: stats.total_objects, color: 'bg-red-500' },
            { label: 'Achados',     value: stats.found_objects,    total: stats.total_objects, color: 'bg-teal-500' },
            { label: 'Recuperados', value: stats.returned_objects, total: stats.total_objects, color: 'bg-green-500' },
          ].map(({ label, value, total, color }) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-white/40 text-xs w-20 flex-shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-white/40 text-xs w-12 text-right flex-shrink-0">{value.toLocaleString('pt-BR')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Métricas dos Loops de Growth ──────────────────────────────── */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white font-semibold text-sm">Loops de Growth</p>
            <p className="text-white/30 text-xs mt-0.5">Funis de conversão dos fluxos de intenção</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>PostHog</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { icon: MousePointerClick, label: 'Fluxos iniciados', key: 'flow_started',   color: 'text-blue-400 bg-blue-500/10',   desc: 'Cliques nos botões da home' },
            { icon: CheckCircle2,      label: 'Fluxos concluídos', key: 'flow_completed', color: 'text-green-400 bg-green-500/10', desc: 'Chegaram até o CTA final' },
            { icon: Share2,            label: 'Compartilhamentos', key: 'flow_shared',    color: 'text-teal-400 bg-teal-500/10',   desc: 'Cliques em compartilhar' },
            { icon: RefreshCw,         label: 'E-mails reativação', key: 'reactivation',  color: 'text-amber-400 bg-amber-500/10', desc: 'Enviados pelo cron 24h' },
          ].map(({ icon: Icon, label, color, desc }) => (
            <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-white font-bold text-lg">—</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
              <p className="text-white/20 text-[10px] mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Funil por tipo de fluxo */}
        <div className="space-y-2">
          <p className="text-white/30 text-[11px] font-semibold uppercase tracking-wider mb-3">Conversão por fluxo</p>
          {[
            { label: 'Perdi algo',        color: 'bg-red-500',    href: '/flow/lost' },
            { label: 'Encontrei algo',    color: 'bg-teal-500',   href: '/flow/found' },
            { label: 'Quero me prevenir', color: 'bg-blue-500',   href: '/flow/protect' },
            { label: 'Meu pet sumiu',     color: 'bg-amber-500',  href: '/flow/pet' },
            { label: 'Foi roubado',       color: 'bg-orange-500', href: '/flow/stolen' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
              <span className="text-white/40 text-xs flex-1">{label}</span>
              <div className="w-32 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${color} opacity-40 rounded-full`} style={{ width: '0%' }} />
              </div>
              <span className="text-white/20 text-[10px] w-10 text-right">via PostHog</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-white/20" />
          <p className="text-white/20 text-[11px]">Dados em tempo real via PostHog — acesse o dashboard completo em <a href="https://app.posthog.com" target="_blank" rel="noopener noreferrer" className="text-teal-400/60 hover:text-teal-400 underline transition-colors">app.posthog.com</a></p>
        </div>
      </div>

      {/* Atividade recente + mapa quick stats */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Atividade */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Atividade recente</p>
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          </div>
          <div className="space-y-3">
            {activities.length === 0 && (
              <p className="text-white/20 text-xs text-center py-4">Nenhuma atividade registrada ainda.</p>
            )}
            {activities.map(a => {
              const Icon = ACTIVITY_ICONS[a.type] ?? Activity;
              const color = ACTIVITY_COLORS[a.type] ?? 'text-white/50 bg-white/[0.06]';
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="flex-1 text-white/60 text-xs">{a.text}</p>
                  <span className="text-white/20 text-[10px] flex-shrink-0">{a.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick stats geográficos */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Concentração geográfica</p>
          <div className="space-y-2">
            {geoData.length === 0 && (
              <p className="text-white/20 text-xs text-center py-4">Nenhum dado geográfico disponível ainda.</p>
            )}
            {geoData.map(({ city, pct }) => (
              <div key={city} className="flex items-center gap-3">
                <MapPin className="w-3 h-3 text-white/20 flex-shrink-0" />
                <span className="text-white/50 text-xs flex-1">{city}</span>
                <div className="w-24 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-white/30 text-[10px] w-8 text-right">{pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-white/20" />
              <p className="text-white/20 text-[11px]">Dados atualizados em tempo real via Supabase</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
