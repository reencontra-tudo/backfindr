'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Package, Zap, CheckCircle2, DollarSign,
  RefreshCw, Shield, QrCode, ChevronRight, Flame,
  Target, UserCheck, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
  total_users: number; new_users_today: number; new_users_week: number; active_users_week: number;
  total_objects: number; lost_objects: number; found_objects: number; returned_objects: number;
  pending_matches: number; confirmed_matches: number; rejected_matches: number;
  total_scans_today: number;
  mrr?: number; arr?: number; total_subscribers?: number; churn_rate?: number;
  pending_reports?: number;
}
interface ActivityItem { type: string; label: string; ts: string; }
interface GeoItem { city: string; count: number; pct: number; }
interface MrrPoint { month: string; mrr: number; }

const FALLBACK: Stats = {
  total_users: 0, new_users_today: 0, new_users_week: 0, active_users_week: 0,
  total_objects: 0, lost_objects: 0, found_objects: 0, returned_objects: 0,
  pending_matches: 0, confirmed_matches: 0, rejected_matches: 0,
  total_scans_today: 0, mrr: 0, arr: 0, total_subscribers: 0, churn_rate: 0, pending_reports: 0,
};

const ACT_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  user_registered:   { icon: Users,        color: 'text-blue-400',   bg: 'bg-blue-500/10',   label: 'Novo usuário' },
  object_registered: { icon: Package,      color: 'text-teal-400',   bg: 'bg-teal-500/10',   label: 'Objeto registrado' },
  match_confirmed:   { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10',  label: 'Match confirmado' },
  qr_scan:           { icon: QrCode,       color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'QR escaneado' },
};

function KPI({ icon: Icon, label, value, sub, color, trend, trendVal, href }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; trend?: 'up' | 'down' | null; trendVal?: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 transition-all hover:border-white/[0.10] ${href ? 'cursor-pointer group' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && trendVal && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      <p className="text-white/40 text-xs mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mt-1">{sub}</p>}
      {href && <p className="text-teal-400/0 group-hover:text-teal-400/60 text-[10px] mt-2 flex items-center gap-0.5 transition-all">Ver detalhes <ChevronRight className="w-2.5 h-2.5" /></p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const MrrTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1420] border border-white/[0.08] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40 mb-0.5">{label}</p>
      <p className="text-teal-400 font-bold">R$ {payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [geoData, setGeoData] = useState<GeoItem[]>([]);
  const [mrrHistory, setMrrHistory] = useState<MrrPoint[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/admin/stats').then(r => r.json()).catch(() => ({})),
      fetch('/api/v1/admin/activity').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/v1/admin/geo').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/v1/admin/financeiro').then(r => r.json()).catch(() => ({})),
    ]).then(([s, a, g, f]) => {
      setStats({ ...FALLBACK, ...s, mrr: f.mrr ?? 0, arr: f.arr ?? 0, total_subscribers: f.total_subscribers ?? 0, churn_rate: f.churn_rate ?? 0 });
      setActivities(a.items ?? []);
      setGeoData(g.items ?? []);
      setMrrHistory(f.mrr_history ?? []);
      setLastRefresh(new Date());
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const recoveryRate = stats.total_objects > 0 ? Math.round((stats.returned_objects / stats.total_objects) * 100) : 0;
  const matchAcceptRate = (stats.confirmed_matches + stats.rejected_matches) > 0
    ? Math.round((stats.confirmed_matches / (stats.confirmed_matches + stats.rejected_matches)) * 100) : 0;

  const funnelData = [
    { name: 'Perdidos',    value: stats.lost_objects,     fill: '#ef4444' },
    { name: 'Achados',     value: stats.found_objects,    fill: '#14b8a6' },
    { name: 'Recuperados', value: stats.returned_objects, fill: '#22c55e' },
    { name: 'Matches',     value: stats.confirmed_matches, fill: '#eab308' },
  ];

  return (
    <div className="p-5 md:p-7 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-white/25 text-xs mt-0.5">
            Atualizado {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] rounded-xl text-white/40 hover:text-white text-xs transition-all disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Alertas */}
      {(stats.pending_matches > 0 || (stats.pending_reports ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.pending_matches > 0 && (
            <Link href="/admin/matches"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:opacity-80 transition-all">
              <Zap className="w-3.5 h-3.5" />
              {stats.pending_matches} match{stats.pending_matches > 1 ? 'es' : ''} aguardando avaliação
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Link>
          )}
          {(stats.pending_reports ?? 0) > 0 && (
            <Link href="/admin/moderacao"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium text-red-400 bg-red-500/10 border-red-500/20 hover:opacity-80 transition-all">
              <Shield className="w-3.5 h-3.5" />
              {stats.pending_reports} denúncia{(stats.pending_reports ?? 0) > 1 ? 's' : ''} pendente{(stats.pending_reports ?? 0) > 1 ? 's' : ''}
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Link>
          )}
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Users}        label="Usuários totais"    value={loading ? '—' : stats.total_users}
          sub={`+${stats.new_users_today} hoje · +${stats.new_users_week} semana`}
          color="bg-blue-500/15 text-blue-400"
          trend={stats.new_users_week > 0 ? 'up' : null} trendVal={`+${stats.new_users_week}`}
          href="/admin/users" />
        <KPI icon={Package}      label="Objetos registrados" value={loading ? '—' : stats.total_objects}
          sub={`${stats.lost_objects} perdidos · ${stats.found_objects} achados`}
          color="bg-teal-500/15 text-teal-400"
          href="/admin/objects" />
        <KPI icon={CheckCircle2} label="Recuperados"         value={loading ? '—' : stats.returned_objects}
          sub={`Taxa: ${recoveryRate}% de recuperação`}
          color="bg-green-500/15 text-green-400"
          trend={recoveryRate > 50 ? 'up' : null} trendVal={`${recoveryRate}%`} />
        <KPI icon={DollarSign}   label="MRR"                 value={loading ? '—' : `R$ ${(stats.mrr ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub={`${stats.total_subscribers ?? 0} assinantes · Churn ${stats.churn_rate ?? 0}%`}
          color="bg-yellow-500/15 text-yellow-400"
          trend={(stats.mrr ?? 0) > 0 ? 'up' : null} trendVal={(stats.mrr ?? 0) > 0 ? 'Ativo' : undefined}
          href="/admin/financeiro" />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap,      label: 'Matches pendentes', value: loading ? '—' : stats.pending_matches,    sub: 'Aguardando avaliação',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', href: '/admin/matches' },
          { icon: Target,   label: 'Acerto da IA',      value: loading ? '—' : `${matchAcceptRate}%`,    sub: `${stats.confirmed_matches} confirmados`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: QrCode,   label: 'Scans hoje',        value: loading ? '—' : stats.total_scans_today,  sub: 'QR Codes escaneados',   color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { icon: UserCheck, label: 'Ativos (7d)',      value: loading ? '—' : stats.active_users_week,  sub: 'Usuários com sessão',   color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
        ].map(item => (
          <div key={item.label} className={`bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 ${item.href ? 'cursor-pointer hover:border-white/[0.10]' : ''} transition-all`}
            onClick={item.href ? () => window.location.href = item.href : undefined}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.bg}`}>
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              </div>
              <span className="text-white/30 text-xs">{item.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{item.value}</p>
            <p className="text-white/20 text-[10px] mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MRR */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold text-sm">Receita Mensal (MRR)</h3>
              <p className="text-white/25 text-xs mt-0.5">Últimos 6 meses</p>
            </div>
            <Link href="/admin/financeiro" className="text-teal-400/50 hover:text-teal-400 text-xs flex items-center gap-1 transition-colors">
              Ver tudo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {mrrHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={mrrHistory} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<MrrTooltip />} />
                <Area type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={2} fill="url(#mrrGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex flex-col items-center justify-center text-white/15 text-sm gap-2">
              <DollarSign className="w-8 h-8 opacity-30" />
              <span>Sem dados de MRR ainda</span>
            </div>
          )}
        </div>

        {/* Funil */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold text-sm">Funil de Objetos</h3>
              <p className="text-white/25 text-xs mt-0.5">Distribuição por status</p>
            </div>
          </div>
          {stats.total_objects > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex flex-col items-center justify-center text-white/15 text-sm gap-2">
              <Package className="w-8 h-8 opacity-30" />
              <span>Sem objetos registrados ainda</span>
            </div>
          )}
        </div>
      </div>

      {/* Atividade + Geo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Atividade recente */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Atividade Recente</h3>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">Nenhuma atividade recente</div>
          ) : (
            <div className="space-y-1">
              {activities.slice(0, 8).map((a, i) => {
                const cfg = ACT_CFG[a.type] ?? { icon: Activity, color: 'text-white/40', bg: 'bg-white/[0.06]', label: a.type };
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/60 text-xs font-medium truncate">{a.label}</p>
                      <p className="text-white/20 text-[10px]">{cfg.label}</p>
                    </div>
                    <p className="text-white/20 text-[10px] flex-shrink-0">
                      {formatDistanceToNow(new Date(a.ts), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Geo */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Concentração Geográfica</h3>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
          ) : geoData.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-sm">Sem dados geográficos ainda</div>
          ) : (
            <div className="space-y-3">
              {geoData.slice(0, 7).map((g, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/55 font-medium">{g.city}</span>
                    <span className="text-white/25">{g.count} obj · {g.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${g.pct}%`, background: i === 0 ? '#14b8a6' : i === 1 ? '#6366f1' : i === 2 ? '#f59e0b' : 'rgba(255,255,255,0.15)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/admin/matches',   icon: Zap,       label: 'Avaliar Matches',  sub: `${stats.pending_matches} pendentes`,        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/15' },
          { href: '/admin/moderacao', icon: Shield,    label: 'Moderação',        sub: `${stats.pending_reports ?? 0} denúncias`,   color: 'text-red-400 bg-red-500/10 border-red-500/15' },
          { href: '/admin/emails',    icon: Activity,  label: 'Campanhas',        sub: 'E-mail marketing',                          color: 'text-blue-400 bg-blue-500/10 border-blue-500/15' },
          { href: '/admin/sistema',   icon: RefreshCw, label: 'Rodar Matching',   sub: 'IA automática',                             color: 'text-teal-400 bg-teal-500/10 border-teal-500/15' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:opacity-80 ${a.color}`}>
            <a.icon className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{a.label}</p>
              <p className="text-[10px] opacity-60 mt-0.5">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
