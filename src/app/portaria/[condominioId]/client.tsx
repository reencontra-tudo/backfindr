'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, QrCode, CheckCircle2, History,
  LogOut, Loader2, X, Camera, AlertCircle,
  ArrowLeft, Clock, User, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuth';
import { api, parseApiError } from '@/lib/api';
import Cookies from 'js-cookie';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useBranding } from '@/hooks/useBranding';
import PushPermissionBanner from '@/components/PushPermissionBanner';
import { abrirWhatsApp, msgEncomendaChegou, msgCustodiaDestinatario } from '@/lib/whatsapp';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Condominio {
  id: string; nome: string; slug: string; cidade: string; total_unidades: number;
  logo_url: string | null; cor_primaria: string | null; cor_texto: string | null;
}

interface DashboardData {
  condominio: Condominio;
  stats: {
    encomendas_pendentes: number;
    encomendas_entregues_hoje: number;
    encomendas_recebidas_hoje: number;
    custodias_ativas: number;
  };
  encomendas_pendentes: Encomenda[];
  custodias_ativas: Custodia[];
}

interface Encomenda {
  id: string; remetente: string | null; descricao: string | null;
  registrado_em: string; status: string;
  unidade_numero: string | null; unidade_bloco: string | null;
  morador_nome: string | null;
}

interface Custodia {
  id: string; descricao: string; destinatario_nome: string;
  status: string; custodiado_em: string | null; qr_code: string;
  remetente_nome: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function horaRelativa(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', entregue: 'Entregue', aguardando: 'Aguardando',
  custodiado: 'Custodiado', registrado: 'Registrado',
};
const STATUS_DOT: Record<string, string> = {
  pendente: 'bg-yellow-400', entregue: 'bg-green-400',
  custodiado: 'bg-blue-400', registrado: 'bg-purple-400',
};

// ─── Sub-telas ────────────────────────────────────────────────────────────────

// Tela: Registrar Encomenda
function TelaEncomenda({ condominioId, onBack, onSuccess }: {
  condominioId: string; onBack: () => void; onSuccess: () => void;
}) {
  const [etapa, setEtapa]         = useState<'form' | 'sucesso'>('form');
  const [loading, setLoading]     = useState(false);
  const [remetente, setRemetente]     = useState('');
  const [unidade, setUnidade]         = useState('');
  const [bloco, setBloco]             = useState('');
  const [descricao, setDescricao]     = useState('');
  const [moradorTel, setMoradorTel]   = useState('');
  const [moradorNome, setMoradorNome] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidade.trim()) { toast.error('Informe o número da unidade'); return; }
    setLoading(true);
    try {
      await api.post(`/portaria/${condominioId}/encomendas`, {
        unidade_numero: unidade,
        unidade_bloco:  bloco || undefined,
        remetente:      remetente || undefined,
        descricao:      descricao || undefined,
      });
      setEtapa('sucesso');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (etapa === 'sucesso') return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-teal-500/15 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-teal-400" />
      </div>
      <div>
        <p className="text-white text-xl font-bold mb-2">Encomenda registrada!</p>
        <p className="text-[#6B8EC4] text-sm">
          Morador notificado via WhatsApp e push notification.
        </p>
      </div>
      {moradorTel && (
        <button
          onClick={() => abrirWhatsApp(moradorTel, msgEncomendaChegou({
            moradorNome,
            remetente: remetente || 'remetente',
            unidade,
            condominioNome: 'portaria',
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          }))}
          className="w-full py-3.5 bg-[#25D366] hover:bg-[#1ebe5d] rounded-2xl text-white font-bold flex items-center justify-center gap-2 text-sm"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Avisar morador no WhatsApp
        </button>
      )}
      <button onClick={onSuccess}
        className="w-full py-4 bg-[#2563EB] rounded-2xl text-white font-bold">
        Voltar ao painel
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-[#0F2544] px-5 py-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B8EC4] text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="text-white font-bold text-lg">Registrar encomenda</h2>
        <p className="text-[#6B8EC4] text-xs mt-0.5">Informe os dados da entrega</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">

        {/* Unidade — campo principal */}
        <div className="bg-[#162C50] rounded-2xl p-4 space-y-3">
          <p className="text-[#6B8EC4] text-xs font-semibold uppercase tracking-wider">Destinatário</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-white/50 text-xs mb-1 block">Apartamento *</label>
              <input
                value={unidade} onChange={e => setUnidade(e.target.value)}
                placeholder="Ex: 42"
                className="w-full px-3 py-3 bg-[#0F2544] border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div className="w-20">
              <label className="text-white/50 text-xs mb-1 block">Bloco</label>
              <input
                value={bloco} onChange={e => setBloco(e.target.value)}
                placeholder="A"
                className="w-full px-3 py-3 bg-[#0F2544] border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>
        </div>

        {/* Dados da encomenda */}
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Dados da encomenda</p>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Remetente</label>
            <input
              value={remetente} onChange={e => setRemetente(e.target.value)}
              placeholder="Amazon, Shopee, Correios…"
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Observação</label>
            <input
              value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Caixa grande, frágil…"
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="flex-1" />

        <button type="submit" disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{background: "#1D9E75"}}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando…</> : '✓ Confirmar registro'}
        </button>

      </form>
    </div>
  );
}

// Tela: Scan QR de custódia
function TelaScan({ condominioId, onBack, onSuccess }: {
  condominioId: string; onBack: () => void; onSuccess: () => void;
}) {
  const [etapa, setEtapa]     = useState<'scan' | 'detalhe' | 'sucesso'>('scan');
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [custodia, setCustodia] = useState<{
    id: string; descricao: string; destinatario_nome: string; remetente_nome: string | null;
    destinatario_contato?: string;
  } | null>(null);

  const handleScan = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/custody/scan/${code.trim().toUpperCase()}`);
      setCustodia(res.data);
      setEtapa('detalhe');
    } catch {
      toast.error('QR Code não encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!custodia) return;
    setLoading(true);
    try {
      await api.post(`/custody/scan/${qrInput.trim().toUpperCase()}`, {
        tipo: 'porteiro',
      });
      // Vincular ao condomínio via rota da portaria
      await api.post(`/portaria/${condominioId}/custodias`, {
        qr_code: qrInput.trim().toUpperCase(),
      });
      setEtapa('sucesso');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (etapa === 'sucesso') return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-blue-500/15 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-blue-400" />
      </div>
      <div>
        <p className="text-white text-xl font-bold mb-2">Custódia registrada!</p>
        <p className="text-[#6B8EC4] text-sm">Item sob custódia da portaria. Remetente notificado.</p>
      </div>
      {custodia?.destinatario_contato && /^\+?\d{8,}$/.test(custodia.destinatario_contato.replace(/\D/g,'')) && (
        <button
          onClick={() => abrirWhatsApp(
            custodia.destinatario_contato!,
            msgCustodiaDestinatario({
              remetenteNome: custodia.remetente_nome ?? 'portaria',
              descricao: custodia.descricao,
              linkRetirada: `${window.location.origin}/custody/${custodia.id}`,
            })
          )}
          className="w-full py-3.5 bg-[#25D366] hover:bg-[#1ebe5d] rounded-2xl text-white font-bold flex items-center justify-center gap-2 text-sm"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Avisar destinatário no WhatsApp
        </button>
      )}
      <button onClick={onSuccess} className="w-full py-4 bg-[#2563EB] rounded-2xl text-white font-bold">
        Voltar ao painel
      </button>
    </div>
  );

  if (etapa === 'detalhe' && custodia) return (
    <div className="flex-1 flex flex-col">
      <div className="bg-[#0F2544] px-5 py-4">
        <button onClick={() => setEtapa('scan')} className="flex items-center gap-1.5 text-[#6B8EC4] text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="text-white font-bold text-lg">QR identificado</h2>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 space-y-3">
          {[
            { label: 'Item', value: custodia.descricao },
            { label: 'Registrado por', value: custodia.remetente_nome ?? '—' },
            { label: 'Para retirada por', value: custodia.destinatario_nome },
          ].map((f, i) => (
            <div key={i} className={i < 2 ? 'pb-3 border-b border-gray-100' : ''}>
              <p className="text-gray-400 text-xs mb-0.5">{f.label}</p>
              <p className="text-gray-800 font-semibold text-sm">{f.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-sm">
            O destinatário receberá um link para confirmar a retirada quando vier buscar.
          </p>
        </div>
        <button onClick={handleConfirmar} disabled={loading}
          className="w-full py-4 bg-[#5B21B6] hover:bg-[#7C3AED] disabled:opacity-50 rounded-2xl text-white font-bold transition-colors flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔒 Registrar custódia'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-[#0F2544] px-5 py-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B8EC4] text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="text-white font-bold text-lg">Escanear QR Code</h2>
        <p className="text-[#6B8EC4] text-xs mt-0.5">Aponte para o QR colado no objeto</p>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Viewfinder */}
        <div className="relative bg-[#162C50] rounded-3xl overflow-hidden aspect-square flex items-center justify-center">
          <div className="absolute top-5 left-5 w-8 h-8 border-t-4 border-l-4 border-[#7C3AED] rounded-tl-lg" />
          <div className="absolute top-5 right-5 w-8 h-8 border-t-4 border-r-4 border-[#7C3AED] rounded-tr-lg" />
          <div className="absolute bottom-5 left-5 w-8 h-8 border-b-4 border-l-4 border-[#7C3AED] rounded-bl-lg" />
          <div className="absolute bottom-5 right-5 w-8 h-8 border-b-4 border-r-4 border-[#7C3AED] rounded-br-lg" />
          <div className="text-center">
            <Camera className="w-10 h-10 text-[#6B8EC4] mx-auto mb-2" />
            <p className="text-[#6B8EC4] text-sm">Câmera em breve</p>
            <p className="text-[#6B8EC4]/50 text-xs">Use o campo abaixo por enquanto</p>
          </div>
        </div>

        {/* Input manual */}
        <p className="text-[#6B8EC4] text-xs text-center">ou informe o código manualmente</p>
        <div className="flex gap-2">
          <input
            value={qrInput}
            onChange={e => setQrInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleScan(qrInput)}
            placeholder="Código QR (ex: A1B2C3D4)"
            className="flex-1 px-4 py-3 bg-[#162C50] border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#7C3AED] uppercase"
          />
          <button onClick={() => handleScan(qrInput)} disabled={loading || !qrInput.trim()}
            className="px-4 py-3 bg-[#5B21B6] hover:bg-[#7C3AED] disabled:opacity-40 rounded-xl text-white font-bold transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tela: Confirmar retirada de encomenda
function TelaRetirada({ condominioId, onBack, onSuccess }: {
  condominioId: string; onBack: () => void; onSuccess: () => void;
}) {
  const [loading, setLoading]       = useState(false);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [fetching, setFetching]     = useState(true);

  useEffect(() => {
    api.get(`/portaria/${condominioId}/encomendas?status=pendente&size=50`)
      .then(r => setEncomendas(r.data.items))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [condominioId]);

  const confirmar = async (id: string) => {
    setConfirmando(id);
    try {
      await api.patch(`/portaria/${condominioId}/encomendas/${id}/confirmar`);
      setEncomendas(e => e.filter(x => x.id !== id));
      toast.success('Retirada confirmada!');
      if (encomendas.length <= 1) onSuccess();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setConfirmando(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-[#0F2544] px-5 py-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B8EC4] text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="text-white font-bold text-lg">Confirmar retirada</h2>
        <p className="text-[#6B8EC4] text-xs mt-0.5">{encomendas.length} encomenda{encomendas.length !== 1 ? 's' : ''} pendente{encomendas.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#6B8EC4] animate-spin" />
          </div>
        ) : encomendas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle2 className="w-10 h-10 text-teal-400" />
            <p className="text-white/50 text-sm text-center">Nenhuma encomenda pendente</p>
          </div>
        ) : (
          encomendas.map(enc => (
            <div key={enc.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 font-semibold text-sm">
                    Apto {enc.unidade_numero}{enc.unidade_bloco ? ` — Bloco ${enc.unidade_bloco}` : ''}
                  </p>
                  <p className="text-gray-500 text-xs">{enc.remetente ?? 'Remetente não informado'}</p>
                  {enc.morador_nome && (
                    <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" /> {enc.morador_nome}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {horaRelativa(enc.registrado_em)}
                </div>
              </div>
              <button
                onClick={() => confirmar(enc.id)}
                disabled={confirmando === enc.id}
                className="w-full py-2.5 bg-[#065F46] hover:bg-green-700 disabled:opacity-50 rounded-xl text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {confirmando === enc.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> Confirmar retirada</>}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
function TelaDashboard({ data, condominioId, onAcao, onItem }: {
  data: DashboardData;
  condominioId: string;
  onAcao: (a: string) => void;
  onItem: (enc: Encomenda) => void;
}) {
  const { stats, condominio, encomendas_pendentes, custodias_ativas } = data;
  const { styles, cor } = useBranding(condominio);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-[#0F2544] px-5 pt-4 pb-6">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            {condominio.logo_url && (
              <img
                src={condominio.logo_url}
                alt={condominio.nome}
                className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0"
              />
            )}
            <div>
              <p className="text-[#6B8EC4] text-xs font-semibold uppercase tracking-wider mb-1">PORTARIA</p>
              <h1 className="text-white text-xl font-black">{condominio.nome}</h1>
              <p className="text-[#6B8EC4] text-xs">{condominio.cidade}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-400 text-xs font-semibold">Ativo</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Pendentes',  value: stats.encomendas_pendentes,  color: '#F59E0B' },
            { label: 'Custódias',  value: stats.custodias_ativas,      color: '#7C3AED' },
            { label: 'Entregues',  value: stats.encomendas_entregues_hoje, color: '#10B981' },
          ].map((s, i) => (
            <div key={i} className="bg-[#162C50] rounded-2xl p-3 text-center">
              <p style={{ color: s.color }} className="text-2xl font-black">{s.value}</p>
              <p className="text-[#6B8EC4] text-[10px] font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="p-4">
        <p className="text-[#94A3B8] text-[10px] font-bold uppercase tracking-widest mb-3">AÇÕES RÁPIDAS</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: <Package className="w-6 h-6" />, label: 'Registrar\nencomenda', color: '#1B4F8A', action: 'encomenda' },
            { icon: <QrCode className="w-6 h-6" />, label: 'Escanear\nQR Code', color: '#5B21B6', action: 'scan' },
            { icon: <CheckCircle2 className="w-6 h-6" />, label: 'Confirmar\nretirada', color: '#065F46', action: 'retirada' },
            { icon: <History className="w-6 h-6" />, label: 'Ver\nhistórico', color: '#92400E', action: 'historico' },
          ].map((a, i) => (
            <button key={i} onClick={() => onAcao(a.action)}
              className="bg-white rounded-2xl p-4 text-left shadow-sm active:scale-95 transition-transform">
              <div style={{ color: a.color }} className="mb-3">{a.icon}</div>
              <p className="text-[#1E293B] text-sm font-bold leading-tight whitespace-pre-line">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Encomendas pendentes */}
      {encomendas_pendentes.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[#94A3B8] text-[10px] font-bold uppercase tracking-widest mb-3">
            SOB CUSTÓDIA — {encomendas_pendentes.length + custodias_ativas.length} item(s)
          </p>
          <div className="space-y-2.5">
            {encomendas_pendentes.slice(0, 8).map(enc => (
              <button key={enc.id} onClick={() => onItem(enc)}
                className="w-full bg-white rounded-2xl p-4 text-left shadow-sm active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[#1E293B] font-bold text-sm truncate">
                        Apto {enc.unidade_numero ?? '?'} — {enc.remetente ?? 'Sem remetente'}
                      </p>
                      <span className="text-[#94A3B8] text-xs flex-shrink-0">{horaRelativa(enc.registrado_em)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[#64748B] text-xs">{enc.morador_nome ?? '—'}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[enc.status] ?? 'bg-gray-400'}`} />
                        <span className="text-[#64748B] text-xs">{STATUS_LABEL[enc.status] ?? enc.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detalhe de item ──────────────────────────────────────────────────────────
function TelaItem({ enc, condominioId, onBack }: {
  enc: Encomenda; condominioId: string; onBack: () => void;
}) {
  const [loading, setLoading]   = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const confirmar = async () => {
    setLoading(true);
    try {
      await api.patch(`/portaria/${condominioId}/encomendas/${enc.id}/confirmar`);
      setConfirmado(true);
      toast.success('Retirada confirmada!');
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-[#0F2544] px-5 py-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B8EC4] text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="text-white font-bold text-lg">📦 {enc.remetente ?? 'Encomenda'}</h2>
        <p className="text-[#6B8EC4] text-xs mt-0.5">Apto {enc.unidade_numero} · {horaRelativa(enc.registrado_em)}</p>
      </div>
      <div className="flex-1 p-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 space-y-3">
          {[
            { label: 'Destinatário', value: `Apto ${enc.unidade_numero ?? '?'}${enc.unidade_bloco ? ` — Bloco ${enc.unidade_bloco}` : ''}` },
            { label: 'Morador', value: enc.morador_nome ?? 'Não cadastrado' },
            { label: 'Remetente', value: enc.remetente ?? 'Não informado' },
            { label: 'Status', value: STATUS_LABEL[enc.status] ?? enc.status },
            { label: 'Registrado', value: new Date(enc.registrado_em).toLocaleString('pt-BR') },
          ].map((f, i, arr) => (
            <div key={i} className={i < arr.length - 1 ? 'pb-3 border-b border-gray-100' : ''}>
              <p className="text-gray-400 text-xs mb-0.5">{f.label}</p>
              <p className="text-gray-800 font-semibold text-sm">{f.value}</p>
            </div>
          ))}
        </div>

        {!confirmado ? (
          <button onClick={confirmar} disabled={loading}
            className="w-full py-4 bg-[#065F46] hover:bg-green-700 disabled:opacity-50 rounded-2xl text-white font-bold transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirmar retirada</>}
          </button>
        ) : (
          <div className="bg-green-50 rounded-2xl p-5 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
            <p className="text-green-700 font-bold">Retirada confirmada!</p>
            <p className="text-green-600 text-sm">{enc.morador_nome ?? 'Morador'} foi notificado</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function PortariaPWAClient({ condominioId }: { condominioId: string }) {
  const router              = useRouter();
  const { user, logout }    = useAuthStore();
  const { register: registerPush } = usePushNotifications();
  const [tela, setTela]     = useState<'loading' | 'dashboard' | 'encomenda' | 'scan' | 'retirada' | 'item'>('loading');
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<Encomenda | null>(null);
  const [error, setError]   = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get(`/portaria/${condominioId}/dashboard`);
      setDashData(res.data);
      setTela('dashboard');
    } catch (e: unknown) {
      const msg = parseApiError(e);
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        router.push(`/auth/login?redirect=/portaria/${condominioId}`);
      } else {
        setError(msg);
        setTela('dashboard');
      }
    }
  }, [condominioId, router]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  // ── Status bar ──────────────────────────────────────────────────────────
  const StatusBar = () => (
    <div className="bg-[#0F2544] px-5 h-9 flex items-center justify-between">
      <span className="text-[#6B8EC4] text-xs font-semibold">
        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="text-[#6B8EC4] text-xs font-semibold">Backfindr Portaria</span>
      <span className="text-[#6B8EC4] text-xs">{user?.name?.split(' ')[0] ?? ''}</span>
    </div>
  );

  // ── Nav bar inferior ────────────────────────────────────────────────────
  const NavBar = () => (
    <div className="bg-white border-t border-gray-100 flex">
      {[
        { icon: <Building2 className="w-5 h-5" />, label: 'Painel',    t: 'dashboard' },
        { icon: <Package className="w-5 h-5" />,   label: 'Encomenda', t: 'encomenda' },
        { icon: <QrCode className="w-5 h-5" />,    label: 'QR Code',   t: 'scan' },
        { icon: <LogOut className="w-5 h-5" />,    label: 'Sair',      t: 'logout' },
      ].map((n, i) => (
        <button key={i}
          onClick={() => n.t === 'logout' ? handleLogout() : setTela(n.t as typeof tela)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
            tela === n.t ? 'text-[#1B4F8A]' : 'text-gray-400 hover:text-gray-600'
          }`}>
          {n.icon}
          <span className="text-[10px] font-semibold">{n.label}</span>
        </button>
      ))}
    </div>
  );

  // ── Loading ─────────────────────────────────────────────────────────────
  if (tela === 'loading') return (
    <div className="min-h-screen bg-[#0F2544] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      <p className="text-[#6B8EC4] text-sm">Carregando portaria…</p>
    </div>
  );

  return (
    <div className="max-w-[390px] mx-auto min-h-screen flex flex-col bg-[#F1F5FB] font-sans">
      <StatusBar />

      <PushPermissionBanner />

      {error && (
        <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {tela === 'dashboard' && dashData && (
        <TelaDashboard
          data={dashData}
          condominioId={condominioId}
          onAcao={a => { if (a !== 'historico') setTela(a as typeof tela); }}
          onItem={enc => { setItemSelecionado(enc); setTela('item'); }}
        />
      )}

      {tela === 'encomenda' && (
        <TelaEncomenda
          condominioId={condominioId}
          onBack={() => setTela('dashboard')}
          onSuccess={() => { fetchDashboard(); }}
        />
      )}

      {tela === 'scan' && (
        <TelaScan
          condominioId={condominioId}
          onBack={() => setTela('dashboard')}
          onSuccess={() => { fetchDashboard(); }}
        />
      )}

      {tela === 'retirada' && (
        <TelaRetirada
          condominioId={condominioId}
          onBack={() => setTela('dashboard')}
          onSuccess={() => { fetchDashboard(); }}
        />
      )}

      {tela === 'item' && itemSelecionado && (
        <TelaItem
          enc={itemSelecionado}
          condominioId={condominioId}
          onBack={() => setTela('dashboard')}
        />
      )}

      {['dashboard', 'historico'].includes(tela) && <NavBar />}
    </div>
  );
}
