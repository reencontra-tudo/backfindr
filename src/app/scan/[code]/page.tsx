'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, MessageCircle, AlertTriangle, CheckCircle2, Package, ArrowRight, Gift, Share2 } from 'lucide-react';
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lost:     { label: 'Perdido',    color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  found:    { label: 'Encontrado', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  stolen:   { label: 'Roubado',   color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  returned: { label: 'Devolvido', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

export default function ScanPage() {
  const { code } = useParams<{ code: string }>();
  const [obj, setObj] = useState<RegisteredObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    api.get(`/objects/scan/${code}`)
      .then(({ data }) => setObj(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  const notifyOwner = async () => {
    try {
      await api.post(`/objects/scan/${code}/notify`);
      setContactSent(true);
    } catch (err) {
      console.error(parseApiError(err));
      setContactSent(true);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Verificando objeto...</p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !obj) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Objeto não encontrado</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-8">
          Este QR Code não corresponde a nenhum objeto registrado no Backfindr.
          Pode ter sido removido ou o código está incorreto.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold px-6 py-3 rounded-xl transition-all glow-teal"
        >
          Ir para o Backfindr
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // ── Already returned ───────────────────────────────────────────────────────
  if (obj.status === 'returned') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Objeto já recuperado!</h1>
        <p className="text-slate-400 text-sm">Este objeto já foi devolvido ao seu dono.</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[obj.status] ?? STATUS_CONFIG.lost;
  const hasPhoto = obj.photos && obj.photos.length > 0;

  // ── Main — found object ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* ── Hero: foto em destaque ou placeholder ── */}
      <div className="relative w-full">
        {hasPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={obj.photos![0]}
              alt={obj.title}
              className="w-full object-cover"
              style={{ maxHeight: '55vw', minHeight: '220px' }}
            />
            {/* Gradiente suave no topo para o header */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            {/* Gradiente suave na base para a transição */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
            {/* Miniaturas extras */}
            {obj.photos!.length > 1 && (
              <div className="absolute bottom-4 right-4 flex gap-1.5">
                {obj.photos!.slice(1, 4).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${obj.title} ${i + 2}`}
                    className="w-12 h-12 rounded-lg object-cover border-2 border-white/30 shadow-lg"
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Placeholder sem foto */
          <div className="w-full bg-gradient-to-br from-brand-500/20 to-brand-900/30 flex flex-col items-center justify-center gap-3 border-b border-surface-border"
            style={{ height: '180px' }}>
            <span className="text-6xl">{CATEGORY_EMOJI[obj.category] ?? '📦'}</span>
            <span className="text-slate-500 text-xs">Sem foto cadastrada</span>
          </div>
        )}

        {/* Header sobreposto na foto */}
        <div className="absolute inset-x-0 top-0 px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center shadow-lg">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-white text-sm drop-shadow">Backfindr</span>
          </Link>
          <ShareModal
            url={typeof window !== 'undefined' ? window.location.href : `https://backfindr.app/scan/${code}`}
            title={obj.title}
            description={obj.description ?? ''}
            imageUrl={obj.photos?.[0]}
            buttonLabel="Compartilhar"
            buttonClassName="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors drop-shadow"
          />
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 px-4 pb-10">
        <div className="w-full max-w-md mx-auto">

          {contactSent ? (
            /* Success state */
            <div className="glass rounded-3xl p-8 text-center mt-6">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-3">Obrigado!</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                O dono foi notificado que você encontrou o objeto. Em breve entrarão em contato com você.
              </p>
              <div className="glass rounded-xl p-4 text-left">
                <p className="text-slate-500 text-xs mb-1">Objeto</p>
                <p className="text-white font-medium">{obj.title}</p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300 text-sm mt-6 transition-colors"
              >
                Conhecer o Backfindr
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <>
              {/* Título e badge de status */}
              <div className="mt-5 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                  <span className="text-slate-500 text-xs">{CATEGORY_LABEL[obj.category]}</span>
                </div>
                <h1 className="font-display text-2xl font-bold text-white leading-tight">{obj.title}</h1>
              </div>

              {/* Descrição */}
              <div className="bg-surface-card rounded-2xl p-4 mb-4 border border-surface-border">
                <p className="text-slate-500 text-xs mb-1.5">Descrição</p>
                <p className="text-slate-300 text-sm leading-relaxed">{obj.description}</p>
              </div>

              {/* Pet details */}
              {obj.category === 'pet' && (obj.pet_breed || obj.pet_color) && (
                <div className="bg-surface-card rounded-2xl p-4 mb-4 border border-surface-border">
                  <p className="text-slate-500 text-xs mb-2">🐾 Informações do pet</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {obj.pet_breed && (
                      <div>
                        <p className="text-slate-500 text-xs">Raça</p>
                        <p className="text-slate-200">{obj.pet_breed}</p>
                      </div>
                    )}
                    {obj.pet_color && (
                      <div>
                        <p className="text-slate-500 text-xs">Cor</p>
                        <p className="text-slate-200">{obj.pet_color}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recompensa */}
              {obj.reward_amount && obj.reward_amount > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-yellow-400 font-semibold text-sm">Recompensa oferecida</p>
                    <p className="text-white font-bold text-lg">
                      R$ {obj.reward_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {obj.reward_description && (
                      <p className="text-slate-400 text-xs mt-0.5">{obj.reward_description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={notifyOwner}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 active:scale-95 text-white font-semibold py-4 rounded-2xl transition-all glow-teal text-base mb-3"
              >
                <MessageCircle className="w-5 h-5" />
                Encontrei este objeto!
              </button>

              <p className="text-slate-500 text-xs text-center leading-relaxed mb-6">
                Ao clicar, o dono será notificado anonimamente. Seu contato só será compartilhado se você autorizar.
              </p>

              {/* Footer discreto */}
              <p className="text-slate-700 text-xs text-center">
                Powered by{' '}
                <Link href="/" className="text-brand-600 hover:text-brand-500 transition-colors">
                  Backfindr
                </Link>
                {' '}— Plataforma global de recuperação de objetos
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
