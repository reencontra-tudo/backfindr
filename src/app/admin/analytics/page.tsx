'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Users, Package, Zap, QrCode, TrendingUp, TrendingDown,
  DollarSign, BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  range: string;
  overview: {
    total_users: number; new_users: number; new_users_delta: number | null;
    total_objects: number; new_objects: number; new_objects_delta: number | null;
    total_matches: number; new_matches: number; confirmed_matches: number;
    returned_objects: number; recovery_rate: number;
    total_scans: number; new_scans: number;
    mrr: number; arr: number; arpu: number;
  };
  revenue: {
    mrr: number; arr: number; arpu: number;
    pro_count: number; biz_count: number; free_count: number;
    plan_dist: { label: string; value: number; color: string }[];
  };
  series: {
    users:   { label: string; value: number }[];
    objects: { label: string; value: number }[];
    matches: { label: string; value: number }[];
    scans:   { label: string; value: number }[];
  };
  funnel: { label: string; value: number; pct: number }[];
  retention: { week: string; active_users: number }[];
  distributions: {
    by_category:     { label: string; value: number }[];
    by_status:       { label: string; value: number }[];
    by_match_status: { label: string; value: number }[];
  };
  activity: {
    by_dow:  { label: string; value: number }[];
    by_hour: { hour: number; value: number }[];
  };
}

// ─── Paleta ───────────────────────────────────────────────────────────────────
const COLORS = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#f97316', '#ec4899'];
const STATUS_COLORS: Record<string, string> = {
  lost: '#ef4444', found: '#f59e0b', returned: '#14b8a6',
  pending: '#f59e0b', confirmed: '#14b8a6', rejected: '#ef4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString('pt-BR') ?? '0';
const fmtR = (n: number) => `R$ ${n?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtPct = (n: number | null) => n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`;

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-white/30 text-xs">—</span>;
  const up = v >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-teal-400' : 'text-red-400'}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {fmtPct(v)}
    </span>
  );
}

// ─── Componente de card de métrica ────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, sub, delta, color = 'teal',
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  delta?: number | null; color?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
  };
  return (
    <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.teal}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {delta !== undefined && <Delta v={delta ?? null} />}
      </div>
      <p className="text-2xl font-bold text-white font-display">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-white/20 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/[0.1] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'users' | 'objects' | 'matches' | 'scans'>('users');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/admin/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/admin/dashboard');
    }
  }, [user, router]);

  const RANGES = [
    { id: '7d',  label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: '1y',  label: 'Último ano' },
  ] as const;

  const CHART_TABS = [
    { id: 'users',   label: 'Usuários',  color: '#14b8a6' },
    { id: 'objects', label: 'Objetos',   color: '#8b5cf6' },
    { id: 'matches', label: 'Matches',   color: '#f59e0b' },
    { id: 'scans',   label: 'Scans QR',  color: '#3b82f6' },
  ] as const;

  // Mesclar séries para o gráfico principal
  const mergedSeries = (() => {
    if (!data) return [];
    const map: Record<string, Record<string, number>> = {};
    (['users', 'objects', 'matches', 'scans'] as const).forEach(key => {
      data.series[key].forEach(({ label, value }) => {
        if (!map[label]) map[label] = {};
        map[label][key] = value;
      });
    });
    return Object.entries(map).map(([label, vals]) => ({ label, ...vals }));
  })();

  const activeColor = CHART_TABS.find(t => t.id === activeChart)?.color ?? '#14b8a6';

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Carregando analytics…</p>
        </div>
      </div>
    );
  }

  const ov = data?.overview;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Visão completa da plataforma em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.03] border border-white/[0.07] rounded-lg p-0.5">
            {RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  range === r.id
                    ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="p-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-white/40 hover:text-white transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards — linha 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users}     label="Usuários totais"   value={fmt(ov?.total_users ?? 0)}     sub={`+${fmt(ov?.new_users ?? 0)} no período`}    delta={ov?.new_users_delta}  color="teal" />
        <MetricCard icon={Package}   label="Objetos totais"    value={fmt(ov?.total_objects ?? 0)}   sub={`+${fmt(ov?.new_objects ?? 0)} no período`}   delta={ov?.new_objects_delta} color="purple" />
        <MetricCard icon={Zap}       label="Matches criados"   value={fmt(ov?.total_matches ?? 0)}   sub={`${fmt(ov?.confirmed_matches ?? 0)} confirmados`}                            color="amber" />
        <MetricCard icon={QrCode}    label="Scans QR Code"     value={fmt(ov?.total_scans ?? 0)}     sub={`+${fmt(ov?.new_scans ?? 0)} no período`}                                    color="blue" />
      </div>

      {/* KPI Cards — linha 2 (receita) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign}  label="MRR"              value={fmtR(ov?.mrr ?? 0)}           sub="Receita mensal recorrente"  color="green" />
        <MetricCard icon={TrendingUp}  label="ARR"              value={fmtR(ov?.arr ?? 0)}           sub="Receita anual projetada"    color="green" />
        <MetricCard icon={BarChart2}   label="ARPU"             value={fmtR(ov?.arpu ?? 0)}          sub="Receita por usuário"        color="teal" />
        <MetricCard icon={Package}     label="Taxa de recuperação" value={`${ov?.recovery_rate ?? 0}%`} sub={`${fmt(ov?.returned_objects ?? 0)} objetos recuperados`} color="teal" />
      </div>

      {/* Gráfico de série temporal principal */}
      <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-white font-semibold text-sm">Crescimento ao longo do tempo</h2>
          <div className="flex gap-1">
            {CHART_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveChart(t.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  activeChart === t.id ? 'text-white' : 'text-white/30 hover:text-white/60'
                }`}
                style={activeChart === t.id ? { backgroundColor: t.color + '22', color: t.color } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={mergedSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={activeColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={activeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={activeChart} stroke={activeColor} strokeWidth={2} fill="url(#grad)" dot={false} name={CHART_TABS.find(t => t.id === activeChart)?.label} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Linha: Funil + Distribuição por plano */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Funil de conversão */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Funil de conversão</h2>
          <div className="space-y-3">
            {(data?.funnel ?? []).map((step, i) => (
              <div key={step.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/60 text-xs">{step.label}</span>
                  <span className="text-white text-xs font-semibold">{fmt(step.value)} <span className="text-white/30">({step.pct}%)</span></span>
                </div>
                <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${step.pct}%`,
                      backgroundColor: COLORS[i] ?? '#14b8a6',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribuição por plano */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Distribuição por plano</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={data?.revenue.plan_dist ?? []}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={65}
                  dataKey="value" nameKey="label"
                  paddingAngle={3}
                >
                  {(data?.revenue.plan_dist ?? []).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {(data?.revenue.plan_dist ?? []).map(p => (
                <div key={p.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-white/60 text-xs">{p.label}</span>
                  </div>
                  <span className="text-white text-xs font-semibold">{fmt(p.value)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs">MRR</span>
                  <span className="text-teal-400 text-xs font-bold">{fmtR(data?.revenue.mrr ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linha: Retenção + Atividade por dia da semana */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Retenção semanal */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Usuários ativos por semana</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.retention ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="active_users" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Usuários ativos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Atividade por dia da semana */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Atividade por dia da semana</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.activity.by_dow ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Objetos cadastrados" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Linha: Categorias + Status dos objetos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top categorias */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Objetos por categoria</h2>
          <div className="space-y-2.5">
            {(data?.distributions.by_category ?? []).map((cat, i) => {
              const total = (data?.distributions.by_category ?? []).reduce((s, c) => s + c.value, 0);
              const pct   = total > 0 ? Math.round((cat.value / total) * 100) : 0;
              return (
                <div key={cat.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/60 text-xs capitalize">{cat.label}</span>
                    <span className="text-white/40 text-xs">{fmt(cat.value)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status dos objetos */}
        <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
          <h2 className="text-white font-semibold text-sm mb-4">Status dos objetos</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data?.distributions.by_status ?? []}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Objetos">
                {(data?.distributions.by_status ?? []).map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.label] ?? COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap por hora */}
      <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
        <h2 className="text-white font-semibold text-sm mb-4">Heatmap de atividade por hora (últimos 30 dias)</h2>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 24 }, (_, h) => {
            const found = data?.activity.by_hour.find(a => a.hour === h);
            const val   = found?.value ?? 0;
            const max   = Math.max(...(data?.activity.by_hour.map(a => a.value) ?? [1]));
            const intensity = max > 0 ? val / max : 0;
            return (
              <div key={h} className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-md transition-all"
                  style={{
                    backgroundColor: `rgba(20, 184, 166, ${0.05 + intensity * 0.85})`,
                    border: `1px solid rgba(20, 184, 166, ${0.1 + intensity * 0.4})`,
                  }}
                  title={`${h}h: ${val} objetos`}
                />
                <span className="text-white/20 text-[9px]">{h}h</span>
              </div>
            );
          })}
        </div>
        <p className="text-white/20 text-xs mt-3">Intensidade = volume de objetos cadastrados por hora</p>
      </div>

      {/* Matches por status */}
      <div className="p-5 bg-white/[0.02] border border-white/[0.07] rounded-xl">
        <h2 className="text-white font-semibold text-sm mb-4">Pipeline de matches</h2>
        <div className="grid grid-cols-3 gap-4">
          {(data?.distributions.by_match_status ?? []).map((s, i) => (
            <div key={s.label} className="text-center p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <p className="text-2xl font-bold font-display" style={{ color: STATUS_COLORS[s.label] ?? COLORS[i] }}>{fmt(s.value)}</p>
              <p className="text-white/40 text-xs mt-1 capitalize">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
