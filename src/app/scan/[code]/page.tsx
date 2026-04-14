'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, MessageCircle, AlertTriangle, CheckCircle2,
  ArrowLeft, Gift, Share2, ChevronRight, Shield, Clock,
  Heart, Zap
} from 'lucide-react';
import { api, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';
import ShareModal from '@/components/ShareModal';

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa',
  pet: 'Animal de Estimação', bike: 'Bicicleta', document: 'Documento',
  jewelry: 'Joia / Relógio', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Objeto',
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  lost:     { label: 'Desaparecido',  dot: 'bg-red-400',    pill: 'bg-red-500/90 text-white' },
  found:    { label: 'Encontrado',    dot: 'bg-green-400',  pill: 'bg-green-500/90 text-white' },
  stolen:   { label: 'Roubado',      dot: 'bg-orange-400', pill: 'bg-orange-500/90 text-white' },
  returned: { label: 'Devolvido',    dot: 'bg-blue-400',   pill: 'bg-blue-500/90 text-white' },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr));
  } catch { return null; }
}

export default function ScanPage() {
  const { code } = useParams<{ code: string }>();
  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get(`/objects/scan/${code}`)
      .then(({ data }) => setObj(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  const notifyOwner = async () => {
    if (sending) return;
    setSending(true);
    try {
      await api.post(`/objects/scan/${code}/notify`);
      setContactSent(true);
    } catch (err) {
      console.error(parseApiError(err));
      setContactSent(true);
    } finally {
      setSending(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-[#00d4aa]/20" />
            <div className="absolute inset-0 rounded-full border-2 border-t-[#00d4aa] animate-spin" />
            <div className="absolute inset-2 rounded-full bg-[#00d4aa]/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#00d4aa]" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-sm">Verificando objeto</p>
            <p className="text-slate-500 text-xs mt-0.5">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !obj) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="w-9 h-9 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">QR Code inválido</h1>
        <p className="text-slate-400 text-sm max-w-xs mb-8 leading-relaxed">
          Este código não corresponde a nenhum objeto registrado no Backfindr ou foi removido.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#00d4aa] text-black font-bold px-7 py-3.5 rounded-2xl text-sm"
        >
          Ir para o Backfindr
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── Already returned ───────────────────────────────────────────────────────
  if (obj.status === 'returned') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-9 h-9 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Objeto recuperado!</h1>
        <p className="text-slate-400 text-sm">Este objeto já foi devolvido ao seu dono. 🎉</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
  const hasPhoto = obj.photos && obj.photos.length > 0;
  const date = formatDate((obj as any).created_at ?? (obj as any).date);

  // ── Success state ──────────────────────────────────────────────────────────
  if (contactSent) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
        {/* Hero compacto */}
        <div className="relative h-48 bg-gradient-to-br from-[#00d4aa]/20 to-[#0a0a0f] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#00d4aa15_0%,_transparent_70%)]" />
          <div className="w-20 h-20 rounded-3xl bg-green-500/20 border border-green-500/30 flex items-center justify-center z-10">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="flex-1 px-6 -mt-6 relative z-10">
          <div className="bg-[#111118] rounded-3xl border border-white/5 p-8 text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-3">Obrigado!</h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              O dono foi notificado anonimamente. Se ele quiser entrar em contato, você receberá uma mensagem.
            </p>
            <div className="bg-[#0a0a0f] rounded-2xl p-4 text-left border border-white/5">
              <p className="text-slate-500 text-xs mb-1">Objeto reportado</p>
              <p className="text-white font-semibold">{obj.title}</p>
            </div>
          </div>

          {/* Convite para a plataforma */}
          <div className="bg-gradient-to-br from-[#00d4aa]/10 to-[#00d4aa]/5 rounded-3xl border border-[#00d4aa]/20 p-6 text-center">
            <div className="w-10 h-10 rounded-2xl bg-[#00d4aa]/20 flex items-center justify-center mx-auto mb-3">
              <Shield className="w-5 h-5 text-[#00d4aa]" />
            </div>
            <p className="text-white font-semibold text-sm mb-1">Proteja seus objetos também</p>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              Cadastre seus pertences no Backfindr e receba notificações se alguém encontrar.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#00d4aa] text-black font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Conhecer o Backfindr
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col" style={{ paddingBottom: '100px' }}>

      {/* ── HERO: Foto fullscreen com gradiente dramático ── */}
      <div className="relative w-full" style={{ height: hasPhoto ? '65vw' : '220px', minHeight: '240px', maxHeight: '380px' }}>

        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={obj.photos![0]}
            alt={obj.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f1a] via-[#0a1510] to-[#0a0a0f] flex items-center justify-center">
            <div className="text-center">
              <div className="text-7xl mb-3 opacity-60">{CATEGORY_EMOJI[obj.category] ?? '📦'}</div>
              <p className="text-slate-600 text-xs tracking-wide uppercase">Sem foto</p>
            </div>
          </div>
        )}

        {/* Gradiente dramático de baixo para cima */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" />

        {/* Gradiente suave no topo para o header */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Header: logo + compartilhar */}
        <div className="absolute inset-x-0 top-0 px-5 pt-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-[#00d4aa] flex items-center justify-center shadow-lg shadow-[#00d4aa]/30">
              <MapPin className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight drop-shadow-lg">Backfindr</span>
          </Link>
          <ShareModal
            url={typeof window !== 'undefined' ? window.location.href : `https://backfindr.app/scan/${code}`}
            title={obj.title}
            description={obj.description ?? ''}
            imageUrl={obj.photos?.[0]}
            buttonLabel=""
            buttonClassName="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-all"
          />
        </div>

        {/* Status pill flutuante sobre a foto */}
        <div className="absolute bottom-5 left-5">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm shadow-lg ${statusCfg.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-white animate-pulse`} />
            {statusCfg.label}
          </span>
        </div>

        {/* Miniaturas extras */}
        {hasPhoto && obj.photos!.length > 1 && (
          <div className="absolute bottom-5 right-5 flex gap-1.5">
            {obj.photos!.slice(1, 4).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="w-11 h-11 rounded-xl object-cover border-2 border-white/20 shadow-lg"
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="flex-1 px-5 pt-2">

        {/* Categoria + título */}
        <div className="mb-5">
          <p className="text-[#00d4aa] text-xs font-semibold tracking-widest uppercase mb-1.5">
            {CATEGORY_LABEL[obj.category]}
          </p>
          <h1 className="text-[1.65rem] font-extrabold text-white leading-tight tracking-tight">
            {obj.title}
          </h1>
          {date && (
            <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Publicado em {date}
            </p>
          )}
        </div>

        {/* Recompensa — destaque máximo */}
        {obj.reward_amount && obj.reward_amount > 0 && (
          <div className="relative overflow-hidden rounded-3xl mb-5 p-5"
            style={{ background: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)', border: '1px solid #d97706/40' }}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-yellow-400/10 -translate-y-8 translate-x-8" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <p className="text-yellow-200/70 text-xs font-medium uppercase tracking-wide">Recompensa</p>
                <p className="text-yellow-300 font-extrabold text-2xl leading-tight">
                  R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {obj.reward_description && (
                  <p className="text-yellow-200/60 text-xs mt-0.5">{obj.reward_description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Descrição */}
        <div className="rounded-3xl bg-[#111118] border border-white/5 p-5 mb-5">
          <p className="text-[#00d4aa] text-xs font-semibold tracking-widest uppercase mb-3">Descrição</p>
          <p className="text-slate-300 text-sm leading-relaxed">{obj.description}</p>
        </div>

        {/* Pet details */}
        {obj.category === 'pet' && (obj.pet_breed || obj.pet_color) && (
          <div className="rounded-3xl bg-[#111118] border border-white/5 p-5 mb-5">
            <p className="text-[#00d4aa] text-xs font-semibold tracking-widest uppercase mb-3">🐾 Informações do pet</p>
            <div className="grid grid-cols-2 gap-4">
              {obj.pet_breed && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Raça</p>
                  <p className="text-white font-semibold text-sm">{obj.pet_breed}</p>
                </div>
              )}
              {obj.pet_color && (
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Cor</p>
                  <p className="text-white font-semibold text-sm">{obj.pet_color}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trust signals */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: Shield, label: 'Anônimo', sub: 'Sua identidade protegida' },
            { icon: Zap,    label: 'Imediato', sub: 'Dono notificado na hora' },
            { icon: Heart,  label: 'Gratuito', sub: 'Sem custo para você' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="rounded-2xl bg-[#111118] border border-white/5 p-3 text-center">
              <Icon className="w-4 h-4 text-[#00d4aa] mx-auto mb-1.5" />
              <p className="text-white text-xs font-semibold">{label}</p>
              <p className="text-slate-600 text-[10px] leading-tight mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── CTA FIXO NA BASE ── */}
      <div className="fixed bottom-0 inset-x-0 z-50 px-5 pb-8 pt-4"
        style={{ background: 'linear-gradient(to top, #0a0a0f 60%, transparent)' }}>
        <button
          onClick={notifyOwner}
          disabled={sending}
          className="w-full flex items-center justify-center gap-3 text-black font-extrabold py-4.5 rounded-2xl text-base transition-all active:scale-95 disabled:opacity-70 shadow-2xl shadow-[#00d4aa]/30"
          style={{
            background: sending ? '#00b894' : 'linear-gradient(135deg, #00d4aa 0%, #00b894 100%)',
            paddingTop: '1.1rem',
            paddingBottom: '1.1rem',
          }}
        >
          {sending ? (
            <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}
          {sending ? 'Enviando...' : 'Encontrei este objeto!'}
        </button>
        <p className="text-slate-600 text-[11px] text-center mt-2.5 leading-relaxed">
          O dono será notificado anonimamente · Backfindr
        </p>
      </div>

    </div>
  );
}
