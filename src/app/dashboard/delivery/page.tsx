"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Package, MapPin, Clock, CheckCircle2,
  ArrowRight, Truck, ChevronRight
} from "lucide-react";
import Cookies from "js-cookie";

interface Entrega {
  id: string;
  token: string;
  destinatario_nome: string;
  destinatario_phone: string;
  endereco_destino: string;
  status: string;
  created_at: string;
  entregue_em: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  aguardando:  { label: "Aguardando",     color: "text-amber-400",  dot: "bg-amber-400" },
  preparando:  { label: "Preparando",     color: "text-orange-400", dot: "bg-orange-400" },
  saiu:        { label: "A caminho",      color: "text-blue-400",   dot: "bg-blue-400" },
  proximo:     { label: "Chegando",       color: "text-teal-400",   dot: "bg-teal-400" },
  na_portaria: { label: "Na portaria",    color: "text-purple-400", dot: "bg-purple-400" },
  entregue:    { label: "Entregue",       color: "text-green-400",  dot: "bg-green-400" },
  cancelado:   { label: "Cancelado",      color: "text-red-400",    dot: "bg-red-400" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function DeliveryDashboard() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { setLoading(false); return; }

    fetch("/api/v1/delivery/minhas-entregas", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setEntregas(d.items ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ativas = entregas.filter(e => e.status !== "entregue" && e.status !== "cancelado");
  const historico = entregas.filter(e => e.status === "entregue" || e.status === "cancelado");

  return (
    <div className="p-6 md:p-8 max-w-2xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Minhas Entregas</h1>
          <p className="text-white/30 text-sm mt-0.5">Gerencie e rastreie suas entregas</p>
        </div>
        <Link
          href="/dashboard/delivery/nova"
          className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" /> Nova entrega
        </Link>
      </div>

      {/* Ativas */}
      <div>
        <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
          Em andamento — {ativas.length}
        </p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />)}
          </div>
        ) : ativas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl gap-3">
            <Truck className="w-8 h-8 text-white/10" />
            <p className="text-white/30 text-sm">Nenhuma entrega em andamento</p>
            <Link href="/dashboard/delivery/nova"
              className="text-teal-400 text-xs hover:text-teal-300 transition-colors flex items-center gap-1">
              Criar primeira entrega <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {ativas.map(e => {
              const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.aguardando;
              return (
                <Link key={e.id} href={`/delivery/${e.token}`}
                  className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15] rounded-xl transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{e.destinatario_nome}</p>
                    <p className="text-white/30 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {e.endereco_destino}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
                      {cfg.label}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
            Histórico
          </p>
          <div className="space-y-2">
            {historico.slice(0, 5).map(e => {
              const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.entregue;
              return (
                <Link key={e.id} href={`/delivery/${e.token}`}
                  className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-white/[0.10] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-white/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/50 text-sm truncate">{e.destinatario_nome}</p>
                    <p className="text-white/20 text-xs flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {timeAgo(e.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Link para ser entregador */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-white/60 text-sm font-medium">Quer fazer entregas?</p>
          <p className="text-white/30 text-xs mt-0.5">Cadastre-se como entregador e comece a receber pedidos.</p>
        </div>
        <Link href="/delivery/entregador/cadastro"
          className="flex-shrink-0 text-teal-400 text-xs hover:text-teal-300 transition-colors font-medium">
          Saiba mais →
        </Link>
      </div>

    </div>
  );
}
