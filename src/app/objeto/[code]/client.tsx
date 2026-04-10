'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, QrCode, MessageCircle, CheckCircle2, Share2, ChevronRight, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa',
  pet: 'Animal de Estimação', bike: 'Bicicleta', document: 'Documento',
  jewelry: 'Joia / Relógio', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Objeto',
};

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', document: '📄', jewelry: '💍', electronics: '💻', clothing: '👕', other: '📦',
};

export default function PublicObjectClient({ obj }: { obj: RegisteredObject }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const notifyOwner = async () => {
    setLoading(true);
    try {
      await api.post(`/objects/scan/${obj.unique_code}/notify`);
      setSent(true);
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: obj.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  if (obj.status === 'returned') {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center px-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Objeto já recuperado!</h1>
        <p className="text-white/40 text-sm">Este objeto já foi devolvido ao seu dono.</p>
        <Link href="/" className="mt-6 text-teal-400 hover:text-teal-300 text-sm transition-colors">
          Conhecer o Backfindr →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b0f] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
        <button onClick={share} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
          <Share2 className="w-4 h-4" /> Compartilhar
        </button>
      </nav>

      <div className="max-w-lg mx-auto px-5 py-10">
        {sent ? (
          /* Success */
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Obrigado!</h1>
            <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
              O dono foi notificado que você encontrou o objeto. Em breve entrarão em contato com você.
            </p>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-left mb-8">
              <p className="text-white/40 text-xs mb-1">Objeto encontrado</p>
              <p className="text-white font-medium">{CATEGORY_EMOJI[obj.category]} {obj.title}</p>
            </div>
            <Link href="/auth/register" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm transition-colors">
              Registre seus objetos no Backfindr <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Object card */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-6">
              {/* Top bar */}
              <div className="bg-teal-500/[0.07] border-b border-teal-500/[0.12] px-5 py-3.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <QrCode className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div>
                  <p className="text-teal-300 text-[13px] font-medium">Objeto registrado no Backfindr</p>
                  <p className="text-white/30 text-xs">Você encontrou este item?</p>
                </div>
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start gap-4 mb-5">
                  {obj.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={obj.photos[0]}
                      alt={obj.title}
                      className="w-16 h-16 rounded-xl object-cover border border-white/[0.08] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-3xl flex-shrink-0">
                      {CATEGORY_EMOJI[obj.category] ?? '📦'}
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">{CATEGORY_LABEL[obj.category]}</p>
                    <h1 className="text-xl font-bold text-white leading-tight">{obj.title}</h1>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
                  <p className="text-white/50 text-[13px] leading-relaxed">{obj.description}</p>
                </div>

                {/* Pet details */}
                {obj.category === 'pet' && (obj.pet_breed || obj.pet_color) && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
                    <p className="text-white/30 text-xs mb-3">🐾 Informações do pet</p>
                    <div className="grid grid-cols-2 gap-3">
                      {obj.pet_species && (
                        <div>
                          <p className="text-white/30 text-xs">Espécie</p>
                          <p className="text-white text-sm capitalize">{obj.pet_species}</p>
                        </div>
                      )}
                      {obj.pet_breed && (
                        <div>
                          <p className="text-white/30 text-xs">Raça</p>
                          <p className="text-white text-sm">{obj.pet_breed}</p>
                        </div>
                      )}
                      {obj.pet_color && (
                        <div>
                          <p className="text-white/30 text-xs">Cor</p>
                          <p className="text-white text-sm">{obj.pet_color}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={notifyOwner}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-all text-[15px]"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5), 0 8px 24px rgba(20,184,166,0.2)' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  {loading ? 'Notificando...' : 'Encontrei este objeto!'}
                </button>

                {/* Privacy note */}
                <div className="flex items-start gap-2 mt-4">
                  <Shield className="w-3.5 h-3.5 text-white/20 flex-shrink-0 mt-0.5" />
                  <p className="text-white/25 text-xs leading-relaxed">
                    Ao clicar, o dono é notificado de forma anônima. Seu contato só será compartilhado se você autorizar.
                  </p>
                </div>
              </div>
            </div>

            {/* All photos */}
            {obj.photos && obj.photos.length > 1 && (
              <div className="mb-6">
                <p className="text-white/30 text-xs mb-3 uppercase tracking-wider">Fotos do objeto</p>
                <div className="grid grid-cols-3 gap-2">
                  {obj.photos.map((url: string, i: number) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt={`${obj.title} — foto ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-xl border border-white/[0.08]"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Backfindr promo */}
            <div className="border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Registre seus objetos</p>
                <p className="text-white/30 text-xs mt-0.5">Grátis · QR Code único · Recuperação garantida</p>
              </div>
              <Link
                href="/auth/register"
                className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0"
              >
                Criar conta <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
