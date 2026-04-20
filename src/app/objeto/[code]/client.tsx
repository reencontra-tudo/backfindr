'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, QrCode, MessageCircle, CheckCircle2, ChevronRight, Shield, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';
import ShareModal from '@/components/ShareModal';

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

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://backfindr.app/objeto/${obj.unique_code}`;

  // Objeto já devolvido
  if (obj.status === 'returned') {
    return (
      <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Este objeto já foi recuperado</h1>
        <p className="text-white/50 text-base leading-relaxed max-w-xs mx-auto">
          O dono já recebeu este item de volta. Obrigado pela boa ação! 🙏
        </p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm transition-colors">
          Conhecer o Backfindr <ChevronRight className="w-4 h-4" />
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
        <ShareModal
          url={shareUrl}
          title={obj.title}
          description={obj.description ?? ''}
          imageUrl={obj.photos?.[0]}
          buttonLabel="Compartilhar"
          buttonClassName="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
        />
      </nav>

      <div className="max-w-lg mx-auto px-5 py-8">
        {sent ? (
          /* ── Tela de sucesso ── */
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-3xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Mensagem enviada!</h1>
            <p className="text-white/50 text-base leading-relaxed mb-6 max-w-xs mx-auto">
              O dono foi avisado que você encontrou o objeto. Ele vai entrar em contato em breve. Obrigado! 🙏
            </p>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-left mb-8">
              <p className="text-white/40 text-xs mb-1">Objeto encontrado</p>
              <p className="text-white font-medium text-base">{CATEGORY_EMOJI[obj.category]} {obj.title}</p>
            </div>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Proteja seus objetos também <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* ── Instrução clara no topo ── */}
            <div className="bg-teal-500/[0.08] border border-teal-500/[0.18] rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-teal-300 text-sm font-semibold">Objeto registrado na rede Backfindr</p>
                  {(obj.source === 'webjetos' || obj.is_legacy) && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                      Compartilhado via Webjetos
                    </span>
                  )}
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Este objeto pertence a alguém. Se você o encontrou, clique no botão abaixo para avisar o dono — é rápido e seguro.
                </p>
              </div>
            </div>

            {/* ── Card do objeto ── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-6">
              <div className="p-5">
                {/* Foto + título */}
                <div className="flex items-start gap-4 mb-5">
                  {obj.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={obj.photos[0]}
                      alt={obj.title}
                      className="w-20 h-20 rounded-xl object-cover border border-white/[0.08] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-4xl flex-shrink-0">
                      {CATEGORY_EMOJI[obj.category] ?? '📦'}
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 text-xs mb-1">{CATEGORY_LABEL[obj.category]}</p>
                    <h1 className="text-xl font-bold text-white leading-tight">{obj.title}</h1>
                  </div>
                </div>

                {/* Descrição */}
                {obj.description && (
                  <div className="mb-5">
                    <p className="text-white/35 text-xs mb-1.5 uppercase tracking-wide">Descrição</p>
                    <p className="text-white/70 text-sm leading-relaxed">{obj.description}</p>
                  </div>
                )}

                {/* Detalhes do pet */}
                {obj.category === 'pet' && (obj.pet_breed || obj.pet_color || obj.pet_species) && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
                    <p className="text-white/40 text-xs mb-3">🐾 Informações do animal</p>
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

                {/* ── Botão principal — grande e claro ── */}
                <button
                  onClick={notifyOwner}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all text-base"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5), 0 8px 24px rgba(20,184,166,0.2)' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  {loading ? 'Enviando aviso...' : 'Avisar o dono que encontrei'}
                </button>

                {/* Nota de privacidade — texto maior e mais claro */}
                <div className="flex items-start gap-2.5 mt-4 bg-white/[0.02] rounded-xl p-3">
                  <Shield className="w-4 h-4 text-teal-400/60 flex-shrink-0 mt-0.5" />
                  <p className="text-white/45 text-xs leading-relaxed">
                    <span className="text-white/70 font-medium">Seus dados estão protegidos.</span>{' '}
                    O dono recebe apenas um aviso. Seu nome e telefone não são revelados automaticamente — você decide o que compartilhar.
                  </p>
                </div>
              </div>
            </div>

            {/* Fotos adicionais */}
            {obj.photos && obj.photos.length > 1 && (
              <div className="mb-6">
                <p className="text-white/30 text-xs mb-3 uppercase tracking-wider">Mais fotos do objeto</p>
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

            {/* Promo — linguagem simples */}
            <div className="border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-white text-sm font-semibold">Proteja seus objetos também</p>
                <p className="text-white/35 text-xs mt-0.5">Gratuito · Fácil de usar · QR Code para tudo</p>
              </div>
              <Link
                href="/auth/register"
                className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold px-3 py-2.5 rounded-lg transition-all flex-shrink-0 whitespace-nowrap"
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
