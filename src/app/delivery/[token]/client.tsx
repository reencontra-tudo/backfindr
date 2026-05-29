'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Package, MapPin, Clock, AlertCircle,
  Loader2, ArrowRight, Navigation, Store, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { usePublicPushPrompt } from '@/hooks/usePublicPushPrompt';
import PushPermissionBanner from '@/components/PushPermissionBanner';

interface EntregaData {
  id: string;
  status: string;
  descricao: string | null;
  destinatario_nome: string;
  endereco_destino: string;
  cliente_lat: number | null;
  cliente_lng: number | null;
  entregador_lat: number | null;
  entregador_lng: number | null;
  ultima_localizacao_em: string | null;
  saiu_em: string | null;
  chegou_em: string | null;
  entregue_em: string | null;
  qr_code: string;
  estabelecimento_nome: string;
  estabelecimento_telefone: string | null;
  entregador_nome: string | null;
  eventos: EntregaEvento[];
}

interface EntregaEvento {
  tipo: string;
  observacao: string | null;
  created_at: string;
}

// ─── Config de status ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string; emoji: string; color: string; bg: string; desc: string;
}> = {
  preparando:  { label: 'Preparando',       emoji: '🍳', color: 'text-orange-400', bg: 'bg-orange-400/10', desc: 'Seu pedido está sendo preparado.' },
  saiu:        { label: 'Saiu para entrega',emoji: '🛵', color: 'text-blue-400',   bg: 'bg-blue-400/10',   desc: 'O entregador está a caminho.' },
  proximo:     { label: 'Chegando',         emoji: '📍', color: 'text-teal-400',   bg: 'bg-teal-400/10',   desc: 'O entregador está quase aí!' },
  na_portaria: { label: 'Na portaria',      emoji: '🔔', color: 'text-purple-400', bg: 'bg-purple-400/10', desc: 'Seu pedido chegou! O entregador está no local.' },
  entregue:    { label: 'Entregue',         emoji: '✅', color: 'text-green-400',  bg: 'bg-green-400/10',  desc: 'Pedido entregue com sucesso.' },
  cancelado:   { label: 'Cancelado',        emoji: '❌', color: 'text-red-400',    bg: 'bg-red-400/10',    desc: 'Esta entrega foi cancelada.' },
};

const EVENTO_LABEL: Record<string, string> = {
  criada:       'Pedido registrado',
  saiu:         'Saiu para entrega',
  proximo:      'Entregador chegando',
  proximo_100m: 'Entregador muito perto',
  na_portaria:  'Chegou no local',
  entregue:     'Entrega confirmada',
  cancelado:    'Cancelado',
  localizacao:  'Localização atualizada',
};

function formatHora(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Barra de progresso por status
const STATUS_STEPS = ['preparando', 'saiu', 'proximo', 'na_portaria', 'entregue'];

function ProgressBar({ status }: { status: string }) {
  const idx = STATUS_STEPS.indexOf(status);
  const pct  = status === 'entregue' ? 100 : Math.min(100, Math.round(((idx + 1) / STATUS_STEPS.length) * 100));

  return (
    <div className="space-y-2">
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {['Preparando', 'Saiu', 'Chegando', 'Portaria', 'Entregue'].map((s, i) => (
          <span key={i} className={`text-[10px] font-semibold ${
            i <= idx ? 'text-teal-400' : 'text-white/20'
          }`}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export default function DeliveryTrackClient({
  token,
  initialData,
}: {
  token: string;
  initialData: EntregaData | null;
}) {
  usePublicPushPrompt(4000);
  const [entrega, setEntrega]     = useState<EntregaData | null>(initialData);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Polling a cada 15s enquanto entrega ativa
  const fetchEntrega = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/delivery/link/${token}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setEntrega(data);
      setLastUpdate(new Date());
    } catch { /* silencioso */ }
  }, [token]);

  useEffect(() => {
    if (!entrega || entrega.status === 'entregue' || entrega.status === 'cancelado') return;
    const interval = setInterval(fetchEntrega, 15000);
    return () => clearInterval(interval);
  }, [entrega, fetchEntrega]);

  // Link inválido
  if (!entrega) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold mb-2">Entrega não encontrada</h1>
          <p className="text-white/40 text-sm">Link inválido ou entrega expirada.</p>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[entrega.status] ?? STATUS_CONFIG.preparando;
  const isAtiva = !['entregue', 'cancelado'].includes(entrega.status);

  const handleConfirmar = async () => {
    setConfirming(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* opcional */ }

      const res = await fetch(`/api/v1/delivery/confirmar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? 'Erro ao confirmar');
      }

      setConfirmed(true);
      setEntrega(e => e ? { ...e, status: 'entregue', entregue_em: new Date().toISOString() } : e);
      toast.success('Entrega confirmada!');
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao confirmar');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <span className="text-sm">📍</span>
          </div>
          <span className="text-white font-bold text-sm">Backfindr Delivery</span>
        </Link>
        {isAtiva && (
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Ao vivo
          </div>
        )}
      </nav>

      <PushPermissionBanner />
      <div className="flex-1 flex flex-col p-5 gap-5 max-w-sm mx-auto w-full">

        {/* Status principal */}
        <div className={`rounded-2xl p-5 border border-white/[0.06] ${cfg.bg} text-center`}>
          <div className="text-5xl mb-3">{cfg.emoji}</div>
          <h1 className={`text-xl font-black ${cfg.color} mb-1`}>{cfg.label}</h1>
          <p className="text-white/50 text-sm">{cfg.desc}</p>
          {entrega.entregador_nome && isAtiva && (
            <p className="text-white/30 text-xs mt-2">
              Entregador: <span className="text-white/50">{entrega.entregador_nome}</span>
            </p>
          )}
        </div>

        {/* Barra de progresso */}
        {!['cancelado'].includes(entrega.status) && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <ProgressBar status={entrega.status} />
          </div>
        )}

        {/* Info do pedido */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
              <Store className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{entrega.estabelecimento_nome}</p>
              {entrega.estabelecimento_telefone && (
                <a href={`tel:${entrega.estabelecimento_telefone}`}
                  className="flex items-center gap-1 text-white/30 hover:text-teal-400 text-xs transition-colors mt-0.5">
                  <Phone className="w-3 h-3" />
                  {entrega.estabelecimento_telefone}
                </a>
              )}
            </div>
          </div>

          {[
            entrega.descricao ? { label: 'Pedido', value: entrega.descricao } : null,
            { label: 'Destinatário', value: entrega.destinatario_nome },
            { label: 'Endereço',     value: entrega.endereco_destino },
            entrega.saiu_em ? { label: 'Saiu às', value: formatHora(entrega.saiu_em) } : null,
            entrega.chegou_em ? { label: 'Chegou às', value: formatHora(entrega.chegou_em) } : null,
            entrega.entregue_em ? { label: 'Entregue às', value: formatHora(entrega.entregue_em) } : null,
          ].filter(Boolean).map((f, i) => (
            <div key={i} className="flex justify-between gap-4 text-sm">
              <span className="text-white/35 flex-shrink-0">{f!.label}</span>
              <span className="text-white text-right">{f!.value}</span>
            </div>
          ))}

          {entrega.ultima_localizacao_em && isAtiva && (
            <p className="text-white/20 text-xs pt-1 border-t border-white/[0.05]">
              Localização atualizada às {formatHora(entrega.ultima_localizacao_em)}
            </p>
          )}
        </div>

        {/* Timeline de eventos */}
        {entrega.eventos && entrega.eventos.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Histórico</p>
            <div className="space-y-3">
              {entrega.eventos
                .filter(e => e.tipo !== 'localizacao')
                .map((ev, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-white/60 text-sm">
                        {EVENTO_LABEL[ev.tipo] ?? ev.tipo}
                      </span>
                      <span className="text-white/25 text-xs">
                        {formatHora(ev.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Botão de confirmação */}
        {(entrega.status === 'na_portaria' || entrega.status === 'proximo') && !confirmed && (
          <button
            onClick={handleConfirmar}
            disabled={confirming}
            className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 rounded-2xl text-white font-bold text-base transition-colors flex items-center justify-center gap-2.5"
          >
            {confirming ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando…</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Confirmar recebimento</>
            )}
          </button>
        )}

        {(confirmed || entrega.status === 'entregue') && (
          <div className="bg-green-400/10 border border-green-400/20 rounded-2xl p-4 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto" />
            <p className="text-green-300 font-bold text-sm">Recebimento confirmado</p>
            <p className="text-green-300/50 text-xs">Obrigado por usar o Backfindr Delivery!</p>
          </div>
        )}

        {/* CTA cadastro */}
        <div className="border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-white text-sm font-semibold">Proteja seus objetos</p>
            <p className="text-white/35 text-xs mt-0.5">QR Code gratuito · Fácil de usar</p>
          </div>
          <Link href="/auth/register"
            className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-colors flex-shrink-0">
            Criar conta <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </div>
  );
}
