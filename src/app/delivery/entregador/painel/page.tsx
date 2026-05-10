"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Truck, Package, MapPin, CheckCircle2,
  ChevronRight, Loader2, RefreshCw, ArrowLeft
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
}

interface Entregador {
  id: string;
  nome: string;
  phone: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; next: string; nextLabel: string }> = {
  aguardando:  { label: "Aguardando",     color: "text-amber-400",  next: "saiu",        nextLabel: "Sair para entrega" },
  saiu:        { label: "A caminho",      color: "text-blue-400",   next: "na_portaria", nextLabel: "Cheguei no destino" },
  na_portaria: { label: "No destino",     color: "text-purple-400", next: "entregue",    nextLabel: "Confirmar entrega" },
  entregue:    { label: "Entregue",       color: "text-green-400",  next: "",            nextLabel: "" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function EntregadorPainelPage() {
  const [entregador, setEntregador] = useState<Entregador | null>(null);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [notEntregador, setNotEntregador] = useState(false);

  const token = Cookies.get("access_token");

  const fetchDados = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      // Buscar perfil do entregador
      const perfil = await fetch("/api/v1/delivery/entregador/perfil", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!perfil.ok) { setNotEntregador(true); setLoading(false); return; }
      const perfilData = await perfil.json();
      setEntregador(perfilData);

      // Buscar entregas disponíveis e ativas
      const res = await fetch(`/api/v1/delivery/entregador/entregas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setEntregas(d.items ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  const atualizarStatus = async (entregaId: string, novoStatus: string) => {
    setAtualizando(entregaId);
    try {
      await fetch(`/api/v1/delivery/entregas/${entregaId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: novoStatus }),
      });
      await fetchDados();
    } catch {
    } finally {
      setAtualizando(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
      </div>
    );
  }

  if (notEntregador) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Truck className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-white/50">Você não está cadastrado como entregador.</p>
          <Link href="/delivery/entregador/cadastro"
            className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl">
            Cadastrar agora
          </Link>
        </div>
      </div>
    );
  }

  const ativas = entregas.filter(e => e.status !== "entregue" && e.status !== "cancelado");
  const concluidas = entregas.filter(e => e.status === "entregue");

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">

      {/* Header */}
      <header className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-white/30 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">{entregador?.nome}</p>
              <p className="text-white/30 text-[10px]">Entregador</p>
            </div>
          </div>
        </div>
        <button onClick={fetchDados} className="text-white/30 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <div className="p-5 space-y-6 max-w-lg mx-auto">

        {/* Entregas ativas */}
        <div>
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
            Em andamento — {ativas.length}
          </p>

          {ativas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-2xl gap-3">
              <Package className="w-8 h-8 text-white/10" />
              <p className="text-white/30 text-sm">Nenhuma entrega ativa no momento</p>
              <p className="text-white/20 text-xs">Aguarde novas entregas aparecerem aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ativas.map(e => {
                const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.aguardando;
                return (
                  <div key={e.id} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{e.destinatario_nome}</p>
                        <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{e.endereco_destino}</span>
                        </p>
                        <p className="text-white/20 text-xs mt-0.5">{timeAgo(e.created_at)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold flex-shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Link href={`/delivery/${e.token}`}
                        className="flex-1 py-2 border border-white/[0.08] rounded-xl text-white/40 text-xs font-medium text-center hover:border-white/20 transition-colors">
                        Ver rastreio
                      </Link>
                      {cfg.next && (
                        <button
                          onClick={() => atualizarStatus(e.id, cfg.next)}
                          disabled={atualizando === e.id}
                          className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          {atualizando === e.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> {cfg.nextLabel}</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Histórico */}
        {concluidas.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
              Concluídas hoje — {concluidas.length}
            </p>
            <div className="space-y-2">
              {concluidas.slice(0, 5).map(e => (
                <Link key={e.id} href={`/delivery/${e.token}`}
                  className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-white/[0.10] transition-all">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/50 text-sm truncate">{e.destinatario_nome}</p>
                    <p className="text-white/20 text-xs truncate">{e.endereco_destino}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
