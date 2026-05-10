"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package, QrCode, TrendingUp, Users, CheckCircle2,
  AlertTriangle, ArrowRight, Plus, BarChart3, ChevronRight,
  Building2, Clock
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuth";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ParceiroStats {
  partner_name?: string;
  total_objects?: number;
  lost_objects?: number;
  found_objects?: number;
  returned_objects?: number;
  total_users?: number;
  recovery_rate?: number;
  objects_this_week?: number;
}

interface RecentObject {
  id: string;
  title: string;
  status: string;
  category: string;
  created_at: string;
  owner_name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  lost:     "text-red-400 bg-red-500/10 border-red-500/20",
  found:    "text-teal-400 bg-teal-500/10 border-teal-500/20",
  returned: "text-green-400 bg-green-500/10 border-green-500/20",
  stolen:   "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  lost: "Perdido", found: "Achado", returned: "Recuperado", stolen: "Roubado",
};

const EMOJI: Record<string, string> = {
  phone:"📱", wallet:"👛", keys:"🔑", bag:"🎒", pet:"🐾",
  bike:"🚲", document:"📄", jewelry:"💍", electronics:"💻", other:"📦",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
      {sub && <p className="text-white/20 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParceiroClient() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const [stats, setStats] = useState<ParceiroStats>({});
  const [objects, setObjects] = useState<RecentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);

  // Auth check
  useEffect(() => {
    const check = async () => {
      if (!user) await fetchMe().catch(() => {});
      setChecking(false);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checking) return;
    if (!user) { router.replace("/auth/login?redirect=/parceiro"); return; }
    // Usuário sem role B2B vai para o dashboard normal
    if (user.role === "user") { router.replace("/dashboard"); return; }
  }, [checking, user, router]);

  // Fetch dados
  useEffect(() => {
    if (!user?.b2b_partner_id) { setLoading(false); return; }
    Promise.allSettled([
      fetch(`/api/v1/admin/b2b/${user.b2b_partner_id}/stats`).then(r => r.json()),
      fetch(`/api/v1/admin/b2b/${user.b2b_partner_id}/objects`).then(r => r.json()),
    ]).then(([statsRes, objRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value ?? {});
      if (objRes.status === "fulfilled") {
        const d = objRes.value;
        setObjects((Array.isArray(d) ? d : d?.items ?? []).slice(0, 6));
      }
    }).finally(() => setLoading(false));
  }, [user]);

  if (checking || loading) return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
    </div>
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = user?.name?.split(" ")[0] ?? "";
  const rate = stats.recovery_rate ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-white/30 text-sm mt-0.5">
            {stats.partner_name ?? "Portal do Parceiro"}
          </p>
        </div>
        <Link
          href="/parceiro/objetos"
          className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Novo objeto
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total de objetos"
          value={stats.total_objects ?? "—"}
          sub={stats.objects_this_week != null ? `+${stats.objects_this_week} essa semana` : undefined}
          icon={Package}
          color="bg-teal-500/10 text-teal-400"
        />
        <StatCard
          label="Perdidos"
          value={stats.lost_objects ?? "—"}
          icon={AlertTriangle}
          color="bg-red-500/10 text-red-400"
        />
        <StatCard
          label="Recuperados"
          value={stats.returned_objects ?? "—"}
          icon={CheckCircle2}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          label="Usuários"
          value={stats.total_users ?? "—"}
          sub="vinculados"
          icon={Users}
          color="bg-blue-500/10 text-blue-400"
        />
      </div>

      {/* Taxa de recuperação */}
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            <span className="text-white/60 text-sm font-medium">Taxa de recuperação</span>
          </div>
          <span className="text-green-400 font-bold text-lg">{Math.round(rate)}%</span>
        </div>
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-green-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
        <p className="text-white/20 text-xs mt-2">
          {stats.returned_objects ?? 0} de {stats.total_objects ?? 0} objetos recuperados
        </p>
      </div>

      {/* Objetos recentes + acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Objetos recentes */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <span className="text-white/50 text-xs font-mono uppercase tracking-wider">Objetos recentes</span>
            <Link href="/parceiro/objetos" className="text-teal-400/60 hover:text-teal-400 text-[11px] flex items-center gap-1 transition-colors">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {objects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Package className="w-8 h-8 text-white/10" />
                <p className="text-white/25 text-sm text-center">Nenhum objeto registrado ainda</p>
                <Link href="/parceiro/objetos"
                  className="text-teal-400 text-xs hover:text-teal-300 transition-colors mt-1 flex items-center gap-1">
                  Registrar primeiro <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-0">
                {objects.map((obj, idx) => (
                  <div key={obj.id}
                    className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-base flex-shrink-0">
                      {EMOJI[obj.category] ?? "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-[13px] font-medium truncate">{obj.title}</p>
                      <p className="text-white/30 text-[11px] flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(obj.created_at)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[obj.status] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                      {STATUS_LABEL[obj.status] ?? obj.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Acesso rápido */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.05]">
            <span className="text-white/50 text-xs font-mono uppercase tracking-wider">Acesso rápido</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: "Meus objetos",     sub: "Ver e gerenciar registros",    href: "/parceiro/objetos",       icon: Package,    color: "text-teal-400 bg-teal-500/10" },
              { label: "QR Codes",         sub: "Gerar e imprimir etiquetas",   href: "/parceiro/qrcodes",       icon: QrCode,     color: "text-purple-400 bg-purple-500/10" },
              { label: "Relatórios",       sub: "Estatísticas detalhadas",      href: "/parceiro/relatorios",    icon: BarChart3,  color: "text-amber-400 bg-amber-500/10" },
              { label: "Equipe",           sub: "Gerenciar colaboradores",      href: "/parceiro/equipe",        icon: Users,      color: "text-blue-400 bg-blue-500/10" },
              { label: "Configurações",    sub: "Perfil e preferências",        href: "/parceiro/configuracoes", icon: Building2,  color: "text-white/40 bg-white/[0.05]" },
            ].map(({ label, sub, href, icon: Icon, color }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium">{label}</p>
                  <p className="text-white/30 text-xs">{sub}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Suporte */}
      <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-teal-300/80 text-sm font-medium">Precisa de ajuda?</p>
          <p className="text-white/30 text-xs mt-0.5">Fale com o suporte Backfindr para dúvidas sobre o portal.</p>
        </div>
        <a href="mailto:suporte@backfindr.com"
          className="flex-shrink-0 text-teal-400 text-xs hover:text-teal-300 transition-colors font-medium">
          suporte@backfindr.com →
        </a>
      </div>

    </div>
  );
}
