"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Clock, CheckCircle2, ArrowLeft, Building2 } from "lucide-react";
import Cookies from "js-cookie";

interface Encomenda {
  id: string;
  remetente: string | null;
  descricao: string | null;
  status: string;
  registrado_em: string;
}

interface Unidade {
  id: string;
  condominio_id: string;
  condominio_nome: string;
  condominio_slug: string;
  numero: string;
  bloco: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pendente:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  aguardando: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  registrado: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  entregue:   "text-green-400 bg-green-500/10 border-green-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  pendente:   "Aguardando retirada",
  aguardando: "Aguardando retirada",
  registrado: "Registrado",
  entregue:   "Retirado",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function EncomendasPage() {
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { setLoading(false); return; }

    fetch("/api/v1/portaria/minha-unidade", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!data?.condominio_id) { setLoading(false); return; }
        setUnidade(data);

        const res = await fetch(
          `/api/v1/portaria/${data.condominio_id}/encomendas?size=30`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const d = await res.json();
          setEncomendas(d.items ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pendentes = encomendas.filter(e =>
    ["pendente", "aguardando", "registrado"].includes(e.status)
  );
  const historico = encomendas.filter(e => e.status === "entregue");

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-white/30 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-white font-bold text-xl">Minhas Encomendas</h1>
          {unidade && (
            <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {unidade.condominio_nome} · Apto {unidade.numero}
              {unidade.bloco ? ` — Bloco ${unidade.bloco}` : ""}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !unidade ? (
        <div className="text-center py-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <Building2 className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/50 font-medium">Você não está vinculado a nenhum condomínio</p>
          <p className="text-white/30 text-sm mt-1">Acesse a página do seu condomínio para se cadastrar.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {pendentes.length > 0 ? (
            <div>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
                Aguardando retirada — {pendentes.length}
              </p>
              <div className="space-y-2">
                {pendentes.map(enc => (
                  <div
                    key={enc.id}
                    className="bg-amber-500/[0.05] border border-amber-500/20 rounded-xl p-4 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium">
                        {enc.remetente ?? "Encomenda"}
                      </p>
                      <p className="text-white/30 text-xs flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {timeAgo(enc.registrado_em)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${STATUS_COLOR[enc.status] ?? ""}`}>
                      {STATUS_LABEL[enc.status] ?? enc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-white/20 flex-shrink-0" />
              <p className="text-white/30 text-sm">Nenhuma encomenda aguardando retirada</p>
            </div>
          )}

          {historico.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">
                Histórico
              </p>
              <div className="space-y-2">
                {historico.map(enc => (
                  <div
                    key={enc.id}
                    className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-white/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-sm">{enc.remetente ?? "Encomenda"}</p>
                      <p className="text-white/20 text-xs mt-0.5">{timeAgo(enc.registrado_em)}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full border text-green-400 bg-green-500/10 border-green-500/20 flex-shrink-0">
                      Retirado
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
