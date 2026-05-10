'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Building2, ArrowRight, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Encomenda {
  id: string;
  remetente: string | null;
  status: string;
  registrado_em: string;
  unidade_numero: string | null;
  condominio_nome?: string;
}

interface UnidadeInfo {
  condominio_nome: string;
  condominio_slug: string;
  condominio_id: string;
  numero: string;
  bloco: string | null;
}

function horaRelativa(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function CondominioWidget() {
  const [unidade, setUnidade]       = useState<UnidadeInfo | null>(null);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        // Buscar unidade do morador autenticado
        const unRes = await api.get('/portaria/minha-unidade');
        const u = unRes.data as UnidadeInfo;
        setUnidade(u);

        // Buscar encomendas pendentes desta unidade
        const encRes = await api.get(
          `/portaria/${u.condominio_id}/encomendas?status=pendente&size=5`
        );
        setEncomendas(encRes.data.items ?? []);
      } catch {
        // Morador sem condomínio vinculado — não exibe o widget
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  // Sem condomínio vinculado — não renderiza nada
  if (loading || !unidade) return null;

  return (
    <div className="mb-6 space-y-3">

      {/* Header do condomínio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-400" />
          <span className="text-white/60 text-sm font-semibold">{unidade.condominio_nome}</span>
          <span className="text-white/25 text-xs">
            Apto {unidade.numero}{unidade.bloco ? ` · Bloco ${unidade.bloco}` : ''}
          </span>
        </div>
      </div>

      {/* Encomendas pendentes */}
      {encomendas.length > 0 ? (
        <div className="space-y-2">
          {encomendas.map(enc => (
            <div key={enc.id}
              className="flex items-center gap-3 bg-teal-500/[0.06] border border-teal-500/20 rounded-xl px-4 py-3">
              <Package className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-teal-200 text-sm font-semibold truncate">
                  📦 Encomenda na portaria
                </p>
                <p className="text-teal-300/50 text-xs mt-0.5">
                  {enc.remetente ?? 'Remetente não informado'} · {horaRelativa(enc.registrado_em)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-400/50 flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-white/20 flex-shrink-0" />
          <p className="text-white/30 text-sm">Nenhuma encomenda pendente na portaria</p>
        </div>
      )}

    </div>
  );
}
