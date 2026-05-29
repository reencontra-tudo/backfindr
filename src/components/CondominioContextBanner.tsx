"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Bell, Building2, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import Cookies from "js-cookie";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MinhaUnidade {
  condominio_id: string;
  condominio_nome: string;
  condominio_slug: string;
  condominio_logo: string | null;
  numero: string;
  bloco: string | null;
  encomendas_pendentes: number;
  ultima_encomenda: string | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CondominioContextBanner() {
  const [unidade, setUnidade] = useState<MinhaUnidade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { setLoading(false); return; }

    fetch("/api/v1/portaria/minha-unidade", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.condominio_id) setUnidade(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Usuário não tem vínculo com condomínio — não renderiza nada
  if (loading || !unidade) return null;

  const temEncomendas = unidade.encomendas_pendentes > 0;

  return (
    <div className={`mb-6 rounded-xl border overflow-hidden ${
      temEncomendas
        ? "border-amber-500/30 bg-amber-500/[0.05]"
        : "border-white/[0.08] bg-white/[0.02]"
    }`}>
      {/* Header do condomínio */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
          {unidade.condominio_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={unidade.condominio_logo}
              alt={unidade.condominio_nome}
              className="w-6 h-6 object-contain"
            />
          ) : (
            <Building2 className="w-4 h-4 text-white/40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-sm font-medium truncate">{unidade.condominio_nome}</p>
          <p className="text-white/30 text-xs">
            Apto {unidade.numero}{unidade.bloco ? ` — Bloco ${unidade.bloco}` : ""}
          </p>
        </div>
        <Link
          href={`/condominio/${unidade.condominio_slug}`}
          className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
          target="_blank"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Encomendas */}
      <div className="px-4 py-3">
        {temEncomendas ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Package className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-amber-300 text-sm font-medium">
                {unidade.encomendas_pendentes} encomenda{unidade.encomendas_pendentes > 1 ? "s" : ""} na portaria
              </p>
              {unidade.ultima_encomenda && (
                <p className="text-white/30 text-xs flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Chegou {formatTime(unidade.ultima_encomenda)}
                </p>
              )}
            </div>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full flex-shrink-0">
              Retirar
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-white/20" />
            </div>
            <p className="text-white/30 text-sm">Nenhuma encomenda aguardando retirada</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}
