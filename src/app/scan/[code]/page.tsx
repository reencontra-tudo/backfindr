'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Phone, MessageCircle, AlertTriangle, CheckCircle2, Package, ArrowRight, Gift } from 'lucide-react';
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
      setContactSent(true); // Still show success to finder
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

  // ── Main — found object ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="gradient-brand py-1" />
      <nav className="glass border-b border-surface-border px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-white text-sm">Backfindr</span>
        </Link>
        <ShareModal
          url={typeof window !== 'undefined' ? window.location.href : `https://backfindr.app/scan/${code}`}
          title={obj.title}
          description={obj.description ?? ''}
          imageUrl={obj.photos?.[0]}
          buttonLabel="Compartilhar"
          buttonClassName="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
        />
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {contactSent ? (
            /* Success state */
            <div className="glass rounded-3xl p-8 text-center">
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
            /* Object card */
            <div className="glass rounded-3xl overflow-hidden">
              {/* Top banner */}
              <div className="bg-brand-500/10 border-b border-brand-500/20 px-6 py-4 flex items-center gap-3">
                <Package className="w-5 h-5 text-brand-400" />
                <div>
                  <p className="text-brand-300 text-sm font-medium">Objeto registrado no Backfindr</p>
                  <p className="text-brand-400/60 text-xs">Você encontrou este item?</p>
                </div>
              </div>

              <div className="p-6">
                {/* Object info */}
                <div className="flex items-start gap-4 mb-6">
                  {obj.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={obj.photos[0]}
                      alt={obj.title}
                      className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-surface-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center text-4xl flex-shrink-0 border border-surface-border">
                      {CATEGORY_EMOJI[obj.category] ?? '📦'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-400 text-xs mb-0.5">{CATEGORY_LABEL[obj.category]}</p>
                    <h1 className="font-display text-xl font-bold text-white leading-tight">{obj.title}</h1>
                  </div>
                </div>

                <div className="bg-surface rounded-xl p-4 mb-6 border border-surface-border">
                  <p className="text-slate-500 text-xs mb-1">Descrição</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{obj.description}</p>
                </div>

                {/* Pet details */}
                {obj.category === 'pet' && (obj.pet_breed || obj.pet_color) && (
                  <div className="bg-surface rounded-xl p-4 mb-6 border border-surface-border">
                    <p className="text-slate-500 text-xs mb-2">🐾 Informações do pet</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
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

                {/* Reward badge */}
                {obj.reward_amount && obj.reward_amount > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
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
                  className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold py-4 rounded-2xl transition-all glow-teal text-base mb-3"
                >
                  <MessageCircle className="w-5 h-5" />
                  Encontrei este objeto!
                </button>

                <p className="text-slate-500 text-xs text-center leading-relaxed">
                  Ao clicar, o dono será notificado anonimamente. Seu contato só será compartilhado se você autorizar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-slate-600 text-xs">
          Powered by{' '}
          <Link href="/" className="text-brand-500 hover:text-brand-400 transition-colors">
            Backfindr
          </Link>{' '}
          — Plataforma global de recuperação de objetos
        </p>
      </div>
    </div>
  );
}
