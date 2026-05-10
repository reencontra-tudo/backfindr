'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Package, MapPin, Clock, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { usePublicPushPrompt } from '@/hooks/usePublicPushPrompt';
import { compartilharWhatsApp } from '@/lib/whatsapp';
import PushPermissionBanner from '@/components/PushPermissionBanner';

interface CustodiaData {
  id: string;
  descricao: string;
  status: string;
  destinatario_nome: string;
  remetente_nome: string | null;
  custodiante_nome: string | null;
  condominio_nome: string | null;
  condominio_endereco: string | null;
  custodiado_em: string | null;
  entregue_em: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  registrado:  { label: 'Aguardando custódia', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: <Clock className="w-5 h-5" /> },
  custodiado:  { label: 'Pronto para retirada', color: 'text-teal-400',  bg: 'bg-teal-400/10',  icon: <Package className="w-5 h-5" /> },
  em_transito: { label: 'Em trânsito',          color: 'text-blue-400',  bg: 'bg-blue-400/10',  icon: <MapPin className="w-5 h-5" /> },
  entregue:    { label: 'Entregue',             color: 'text-green-400', bg: 'bg-green-400/10', icon: <CheckCircle2 className="w-5 h-5" /> },
  cancelado:   { label: 'Cancelado',            color: 'text-red-400',   bg: 'bg-red-400/10',   icon: <AlertCircle className="w-5 h-5" /> },
};

function formatData(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CustodyConfirmClient({
  token,
  initialData,
}: {
  token: string;
  initialData: CustodiaData | null;
}) {
  usePublicPushPrompt(4000);
  const [custodia, setCustodia]   = useState<CustodiaData | null>(initialData);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);

  // Link inválido
  if (!custodia) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold mb-2">Link inválido</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Este link não corresponde a nenhuma custódia ativa, ou já expirou.
          </p>
        </div>
        <Link href="/" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
          Ir para o Backfindr
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[custodia.status] ?? STATUS_CONFIG.registrado;

  // Confirmação concluída
  if (confirmed || custodia.status === 'entregue') {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-green-400/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold mb-2">Retirada confirmada!</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Você confirmou a retirada de{' '}
            <span className="text-white font-semibold">"{custodia.descricao}"</span>.
            {custodia.remetente_nome && (
              <> O remetente {custodia.remetente_nome} foi notificado.</>
            )}
          </p>
        </div>
        <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Item</span>
            <span className="text-white font-semibold">{custodia.descricao}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Confirmado em</span>
            <span className="text-white">{formatData(custodia.entregue_em ?? new Date().toISOString())}</span>
          </div>
        </div>
        <div className="space-y-2.5 w-full max-w-sm">
          <button
            onClick={() => compartilharWhatsApp(
              `✅ Recebi meu item pelo Backfindr Custody!

Sistema de custódia rastreável — gratuito:
https://backfindr.com`
            )}
            className="w-full flex items-center justify-center gap-2 py-3.5 border border-[#25D366]/30 hover:border-[#25D366]/60 hover:bg-[#25D366]/5 text-[#25D366] font-semibold rounded-xl transition-all text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Compartilhar no WhatsApp
          </button>
          <Link href="/auth/register"
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-teal-500 hover:bg-teal-400 rounded-xl text-white font-bold text-sm transition-colors">
            Criar conta no Backfindr <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-white/20 text-xs text-center">
            Cadastre seus objetos e receba QR Code de proteção gratuito.
          </p>
        </div>
      </div>
    );
  }

  const handleConfirmar = async () => {
    setConfirming(true);
    try {
      // Tentar obter geolocalização (opcional)
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* geolocalização negada — continua sem */ }

      const res = await fetch(`/api/v1/custody/confirmar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? 'Erro ao confirmar');
      }

      setConfirmed(true);
      setCustodia(c => c ? { ...c, status: 'entregue', entregue_em: new Date().toISOString() } : c);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao confirmar retirada');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <span className="text-sm">📍</span>
          </div>
          <span className="text-white font-bold text-sm">Backfindr Custody</span>
        </Link>
      </nav>

      <PushPermissionBanner />
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">

          {/* Status badge */}
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl ${cfg.bg} border border-white/[0.06]`}>
            <span className={cfg.color}>{cfg.icon}</span>
            <span className={`${cfg.color} font-semibold text-sm`}>{cfg.label}</span>
          </div>

          {/* Info do item */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-white/40" />
              </div>
              <h1 className="text-white text-lg font-bold">{custodia.descricao}</h1>
              <p className="text-white/40 text-sm mt-1">
                Deixado por <span className="text-white/60">{custodia.remetente_nome ?? 'remetente'}</span>
              </p>
            </div>

            <div className="border-t border-white/[0.06] pt-4 space-y-3">
              {[
                { label: 'Destinatário',   value: custodia.destinatario_nome },
                { label: 'Custodiante',    value: custodia.custodiante_nome ?? 'Aguardando' },
                custodia.condominio_nome
                  ? { label: 'Local',      value: custodia.condominio_nome }
                  : null,
                custodia.condominio_endereco
                  ? { label: 'Endereço',   value: custodia.condominio_endereco }
                  : null,
                custodia.custodiado_em
                  ? { label: 'Recebido em', value: formatData(custodia.custodiado_em) }
                  : null,
              ].filter(Boolean).map((f, i) => (
                <div key={i} className="flex justify-between gap-4 text-sm">
                  <span className="text-white/35 flex-shrink-0">{f!.label}</span>
                  <span className="text-white text-right">{f!.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso de segurança */}
          {custodia.status === 'custodiado' && (
            <div className="bg-teal-400/10 border border-teal-400/20 rounded-2xl p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
              <p className="text-teal-200/70 text-sm leading-relaxed">
                Clique em confirmar somente após retirar fisicamente o item. A confirmação gera um comprovante rastreável.
              </p>
            </div>
          )}

          {/* Ação */}
          {custodia.status === 'custodiado' || custodia.status === 'em_transito' ? (
            <button
              onClick={handleConfirmar}
              disabled={confirming}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 rounded-2xl text-white font-bold text-base transition-colors flex items-center justify-center gap-2.5"
            >
              {confirming ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando…</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Confirmar retirada</>
              )}
            </button>
          ) : custodia.status === 'registrado' ? (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-2xl p-4 text-center">
              <p className="text-yellow-300 text-sm">
                O item ainda não chegou ao custodiante. Aguarde e tente novamente mais tarde.
              </p>
            </div>
          ) : null}

          {/* CTA de cadastro */}
          <div className="border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-white text-sm font-semibold">Proteja seus objetos também</p>
              <p className="text-white/35 text-xs mt-0.5">QR Code gratuito para tudo que importa</p>
            </div>
            <Link href="/auth/register"
              className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-colors flex-shrink-0">
              Criar conta <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
