"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, Users, Zap, Building2, TrendingUp, ArrowUpRight,
  ArrowDownRight, Clock, CheckCircle2, AlertCircle, Activity,
  Box, Truck, Store, RefreshCw, ChevronRight, Layers,
  BarChart3, Mail, Shield
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Stats {
  total_users?: number;
  total_objects?: number;
  total_matches?: number;
  pending_matches?: number;
  pending_reports?: number;
  map_eligible_objects?: number;
  map_query_limit?: number;
  active_condominios?: number;
  total_condominios?: number;
  custody_items?: number;
  active_deliveries?: number;
  total_b2b?: number;
  objects_this_week?: number;
  users_this_week?: number;
  matches_this_week?: number;
  devolution_rate?: number;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  created_at: string;
  meta?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

function activityDot(type: string) {
  if (type.includes("match")) return "bg-teal-400";
  if (type.includes("object") || type.includes("objeto")) return "bg-amber-400";
  if (type.includes("user") || type.includes("usuario")) return "bg-blue-400";
  if (type.includes("delivery") || type.includes("entrega")) return "bg-purple-400";
  if (type.includes("custody") || type.includes("custodia")) return "bg-green-400";
  return "bg-white/20";
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, trend, href, color = "teal"
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  href?: string;
  color?: "teal" | "amber" | "blue" | "purple" | "green" | "red";
}) {
  const colorMap = {
    teal:   { bg: "bg-teal-500/10",   border: "border-teal-500/20",   icon: "text-teal-400",   badge: "text-teal-300" },
    amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: "text-amber-400",  badge: "text-amber-300" },
    blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: "text-blue-400",   badge: "text-blue-300" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", icon: "text-purple-400", badge: "text-purple-300" },
    green:  { bg: "bg-green-500/10",  border: "border-green-500/20",  icon: "text-green-400",  badge: "text-green-300" },
    red:    { bg: "bg-red-500/10",    border: "border-red-500/20",    icon: "text-red-400",    badge: "text-red-300" },
  };
  const c = colorMap[color];

  const inner = (
    <div className={`relative group rounded-2xl border ${c.border} bg-white/[0.02] hover:bg-white/[0.04] transition-all p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        {trend === "up" && <ArrowUpRight className="w-4 h-4 text-green-400 opacity-60" />}
        {trend === "down" && <ArrowDownRight className="w-4 h-4 text-red-400 opacity-60" />}
        {href && <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" />}
      </div>
      <div>
        <p className="text-white/35 text-[11px] font-mono uppercase tracking-wider mb-1">{label}</p>
        <p className="text-white text-2xl font-bold leading-none">{value ?? "—"}</p>
        {sub && (
          <p className={`text-[11px] mt-1.5 ${c.badge}`}>{sub}</p>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionCard({ title, children, action }: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <p className="text-white/60 text-xs font-mono uppercase tracking-wider">{title}</p>
        {action && (
          <Link href={action.href} className="text-teal-400/60 hover:text-teal-400 text-[11px] flex items-center gap-1 transition-colors">
            {action.label} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Quick links por módulo ───────────────────────────────────────────────────

const quickLinks = [
  { label: "Objetos",     href: "/admin/objects",               icon: Package,    color: "amber"  as const },
  { label: "Usuários",    href: "/admin/users",                 icon: Users,      color: "blue"   as const },
  { label: "Matches IA",  href: "/admin/matches",               icon: Zap,        color: "teal"   as const },
  { label: "Condomínios", href: "/admin/condominios",           icon: Building2,  color: "purple" as const },
  { label: "Custódia",    href: "/admin/custody",               icon: Box,        color: "green"  as const },
  { label: "Entregas",    href: "/admin/delivery/entregas",     icon: Truck,      color: "teal"   as const },
  { label: "Leads",       href: "/admin/marketing/leads",       icon: TrendingUp, color: "amber"  as const },
  { label: "Reativação",  href: "/admin/marketing/reativacao",  icon: Mail,       color: "blue"   as const },
  { label: "Moderação",   href: "/admin/moderacao",             icon: Shield,     color: "red"    as const },
  { label: "Financeiro",  href: "/admin/financeiro",            icon: BarChart3,  color: "green"  as const },
  { label: "Parceiros",   href: "/admin/delivery/parceiros",    icon: Store,      color: "purple" as const },
  { label: "B2B",         href: "/admin/b2b",                   icon: Layers,     color: "amber"  as const },
];

const colorMap = {
  teal:   "bg-teal-500/10 text-teal-400 border-teal-500/15 hover:border-teal-500/30",
  amber:  "bg-amber-500/10 text-amber-400 border-amber-500/15 hover:border-amber-500/30",
  blue:   "bg-blue-500/10 text-blue-400 border-blue-500/15 hover:border-blue-500/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/15 hover:border-purple-500/30",
  green:  "bg-green-500/10 text-green-400 border-green-500/15 hover:border-green-500/30",
  red:    "bg-red-500/10 text-red-400 border-red-500/15 hover:border-red-500/30",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, actRes] = await Promise.allSettled([
        fetch("/api/v1/admin/stats").then(r => r.json()),
        fetch("/api/v1/admin/activity?limit=8").then(r => r.json()),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value ?? {});
      if (actRes.status === "fulfilled") {
        const data = actRes.value;
        setActivity(Array.isArray(data) ? data : (data?.items ?? data?.activity ?? []));
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const devRate = stats.devolution_rate != null
    ? `${Math.round(stats.devolution_rate)}%`
    : stats.total_matches && stats.total_objects
      ? `${Math.round((stats.total_matches / Math.max(stats.total_objects, 1)) * 100)}%`
      : "—";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Visão geral</h1>
          <p className="text-white/25 text-xs mt-0.5 font-mono">
            Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white/70 hover:border-white/20 text-xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Alertas ativos */}
      {((stats.pending_matches ?? 0) > 0 || (stats.pending_reports ?? 0) > 0 ||
        (stats.map_eligible_objects ?? 0) / (stats.map_query_limit || 1) > 0.7) && (
        <div className="flex flex-wrap gap-3">
          {(stats.pending_matches ?? 0) > 0 && (
            <Link href="/admin/matches"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs hover:bg-amber-500/15 transition-all">
              <AlertCircle className="w-3.5 h-3.5" />
              {stats.pending_matches} match{(stats.pending_matches ?? 0) > 1 ? "es" : ""} pendente{(stats.pending_matches ?? 0) > 1 ? "s" : ""} para revisar
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Link>
          )}
          {(stats.pending_reports ?? 0) > 0 && (
            <Link href="/admin/moderacao"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs hover:bg-red-500/15 transition-all">
              <Shield className="w-3.5 h-3.5" />
              {stats.pending_reports} denúncia{(stats.pending_reports ?? 0) > 1 ? "s" : ""} aguardando moderação
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Link>
          )}
          {/* Capacidade da query do mapa (/api/v1/objects/map) — só aparece
              acima de 70% de uso. Objetivo é avisar com folga real antes do
              LIMIT cortar objeto do mapa silenciosamente, não só quando já
              estourou (ver comentário em objects/map/route.ts). */}
          {(stats.map_eligible_objects ?? 0) / (stats.map_query_limit || 1) > 0.7 && (
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs"
              title="Objetos elegíveis pro mapa se aproximando do teto da query — considere subir MAP_QUERY_LIMIT em objects/map/route.ts"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Mapa: {stats.map_eligible_objects?.toLocaleString("pt-BR")} / {stats.map_query_limit?.toLocaleString("pt-BR")} objetos elegíveis ({Math.round(((stats.map_eligible_objects ?? 0) / (stats.map_query_limit || 1)) * 100)}%)
            </div>
          )}
        </div>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Objetos"
          value={stats.total_objects?.toLocaleString("pt-BR") ?? "—"}
          sub={stats.objects_this_week != null ? `+${stats.objects_this_week} essa semana` : undefined}
          icon={Package}
          trend={stats.objects_this_week != null ? (stats.objects_this_week > 0 ? "up" : "neutral") : undefined}
          href="/admin/objects"
          color="amber"
        />
        <MetricCard
          label="Usuários"
          value={stats.total_users?.toLocaleString("pt-BR") ?? "—"}
          sub={stats.users_this_week != null ? `+${stats.users_this_week} essa semana` : undefined}
          icon={Users}
          trend={stats.users_this_week != null ? (stats.users_this_week > 0 ? "up" : "neutral") : undefined}
          href="/admin/users"
          color="blue"
        />
        <MetricCard
          label="Matches IA"
          value={stats.total_matches?.toLocaleString("pt-BR") ?? "—"}
          sub={stats.pending_matches != null ? `${stats.pending_matches} pendentes` : undefined}
          icon={Zap}
          trend="up"
          href="/admin/matches"
          color="teal"
        />
        <MetricCard
          label="Taxa devolução"
          value={devRate}
          sub="objetos recuperados"
          icon={CheckCircle2}
          color="green"
        />
      </div>

      {/* Métricas secundárias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Condomínios"
          value={stats.active_condominios ?? stats.total_condominios ?? "—"}
          sub={stats.total_condominios != null && stats.active_condominios != null
            ? `${stats.total_condominios - (stats.active_condominios ?? 0)} em onboarding`
            : "ativos"}
          icon={Building2}
          href="/admin/condominios"
          color="purple"
        />
        <MetricCard
          label="Custódia"
          value={stats.custody_items ?? "—"}
          sub="itens em guarda"
          icon={Box}
          href="/admin/custody"
          color="teal"
        />
        <MetricCard
          label="Entregas"
          value={stats.active_deliveries ?? "—"}
          sub="em andamento"
          icon={Truck}
          href="/admin/delivery/entregas"
          color="amber"
        />
        <MetricCard
          label="Parceiros B2B"
          value={stats.total_b2b ?? "—"}
          sub="clientes ativos"
          icon={Layers}
          href="/admin/b2b"
          color="blue"
        />
      </div>

      {/* Linha: atividade + acesso rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Atividade recente */}
        <SectionCard
          title="Atividade recente"
          action={{ label: "Ver tudo", href: "/admin/relatorios" }}
        >
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-white/10 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/[0.05] rounded w-3/4" />
                    <div className="h-2.5 bg-white/[0.03] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Activity className="w-8 h-8 text-white/10" />
              <p className="text-white/25 text-sm">Nenhuma atividade recente</p>
            </div>
          ) : (
            <div className="space-y-0">
              {activity.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${activityDot(item.type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[13px] leading-snug line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-white/20 text-[11px] font-mono whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Acesso rápido */}
        <SectionCard title="Acesso rápido">
          <div className="grid grid-cols-3 gap-2">
            {quickLinks.map(({ label, href, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${colorMap[color]}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-medium text-white/60 leading-none text-center">{label}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Status do sistema */}
      <SectionCard title="Status dos serviços">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "API Next.js",   sub: "localhost:3003", ok: true  },
            { label: "PostgreSQL",    sub: "backfindr-db",   ok: true  },
            { label: "Rastrear",      sub: "localhost:3002", ok: true  },
            { label: "App mobile",    sub: "React Native",   ok: false },
          ].map(({ label, sub, ok }) => (
            <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-green-400 animate-pulse" : "bg-white/15"}`} />
              <div className="min-w-0">
                <p className="text-white/70 text-[12px] font-medium truncate">{label}</p>
                <p className="text-white/20 text-[10px] font-mono truncate">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}
