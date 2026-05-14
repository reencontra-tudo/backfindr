'use client';

import { useState } from 'react';
import { ImageLightbox, useLightbox } from '@/components/ImageLightbox';
import Link from 'next/link';
import { MapPin, MessageCircle, CheckCircle2, ChevronRight, Shield, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, parseApiError } from '@/lib/api';
import { RegisteredObject } from '@/types';
import RecoveredCelebration from '@/components/RecoveredCelebration';

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍', electronics: '💻',
  clothing: '👕', other: '📦',
};

const CATEGORY_LABEL: Record<string, string> = {
  phone: 'Celular', wallet: 'Carteira', keys: 'Chaves', bag: 'Bolsa',
  pet: 'Animal de Estimação', bike: 'Bicicleta', vehicle: 'Veículo', document: 'Documento',
  jewelry: 'Joia / Relógio', electronics: 'Eletrônico', clothing: 'Roupa', other: 'Objeto',
};

const STATUS_LABEL: Record<string, string> = {
  lost: 'Perdido', found: 'Achado', stolen: 'Roubado', returned: 'Recuperado', protected: 'Protegido',
};

const STATUS_COLOR: Record<string, string> = {
  lost: 'text-red-400 bg-red-500/10 border-red-500/20',
  found: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  stolen: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  returned: 'text-green-400 bg-green-500/10 border-green-500/20',
  protected: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function StaticMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  // Usar OpenStreetMap embed via iframe (sem API key)
  const zoom = 14;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] mb-6">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
        <MapPin className="w-4 h-4 text-teal-400" />
        <p className="text-white/60 text-sm">Última localização registrada</p>
      </div>
      <iframe
        title={`Localização de ${title}`}
        src={osmUrl}
        width="100%"
        height="220"
        style={{ border: 0, display: 'block' }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2.5 text-white/40 hover:text-white/70 text-xs transition-colors bg-white/[0.02]"
      >
        <MapPin className="w-3 h-3" />
        Ver no mapa completo
      </a>
    </div>
  );
}

function ShareButtons({ url, title }: { url: string; title: string }) {
  const text = encodeURIComponent(`🔍 Objeto perdido: ${title} — Se você encontrou, avise o dono pelo link:`);
  const encodedUrl = encodeURIComponent(url);

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: `Objeto perdido: ${title}`, url });
      } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  return (
    <div className="mb-6">
      <p className="text-white/30 text-xs mb-3 uppercase tracking-wider">Compartilhar e ajudar a encontrar</p>
      <div className="grid grid-cols-3 gap-2">
        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${text}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 rounded-xl py-3 px-2 transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-[#25D366] text-xs font-medium">WhatsApp</span>
        </a>

        {/* Instagram Stories (copia o link) */}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            toast.success('Link copiado! Cole nos Stories do Instagram.');
          }}
          className="flex flex-col items-center gap-1.5 bg-[#E1306C]/10 border border-[#E1306C]/20 hover:bg-[#E1306C]/20 rounded-xl py-3 px-2 transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#E1306C]">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
          <span className="text-[#E1306C] text-xs font-medium">Instagram</span>
        </button>

        {/* Compartilhar / Copiar */}
        <button
          onClick={handleNativeShare}
          className="flex flex-col items-center gap-1.5 bg-white/[0.04] border border-white/[0.10] hover:bg-white/[0.08] rounded-xl py-3 px-2 transition-all"
        >
          <Share2 className="w-5 h-5 text-white/60" />
          <span className="text-white/60 text-xs font-medium">Mais</span>
        </button>
        </div>
      </div>
  );
}

export default function PublicObjectClient({ obj }: { obj: RegisteredObject }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { open: openLightbox, close: closeLightbox, lightbox } = useLightbox();

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

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://backfindr.com/objeto/${obj.unique_code}`;
  const location = obj.location as { lat?: number; lng?: number; address?: string } | null;
  const allPhotos = obj.photos ?? [];

  // Objeto já devolvido
  if (obj.status === 'returned') {
    return (
      <RecoveredCelebration
        objectTitle={obj.title}
        objectEmoji={CATEGORY_EMOJI[obj.category] ?? '📦'}
        objectCode={obj.unique_code}
        mode="page"
      />
    );
  }

  return (
    <>
      {lightbox && <ImageLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={closeLightbox} />}
      <div className="min-h-screen bg-[#080b0f] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/[0.06] px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-[15px]">Backfindr</span>
        </Link>
        {/* Badge de status */}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[obj.status] ?? 'text-white/40 bg-white/5 border-white/10'}`}>
          {STATUS_LABEL[obj.status] ?? obj.status}
        </span>
      </nav>

      <div className="max-w-lg mx-auto px-5 py-8">
        {sent ? (
          /* ── Tela de sucesso ── */
          <div className="py-8">
            {/* Ícone de sucesso */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-3xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-teal-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Boa ação registrada!</h1>
              <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
                O dono foi notificado. Obrigado por ajudar — isso faz diferença de verdade. 🙏
              </p>
            </div>

            {/* Card do objeto */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 mb-6">
              <p className="text-white/40 text-xs mb-1">Objeto reportado</p>
              <p className="text-white font-medium text-base">{CATEGORY_EMOJI[obj.category]} {obj.title}</p>
            </div>

            {/* O que acontece agora — timeline */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-6">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">O que acontece agora</p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">1</div>
                    <div className="w-px flex-1 bg-white/[0.06] mt-1" />
                  </div>
                  <div className="pb-4">
                    <p className="text-white text-sm font-semibold">Dono recebe notificação agora</p>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">Via push, email ou SMS — dependendo das configurações dele.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xs font-semibold text-white/50 flex-shrink-0">2</div>
                    <div className="w-px flex-1 bg-white/[0.06] mt-1" />
                  </div>
                  <div className="pb-4">
                    <p className="text-white/70 text-sm font-semibold">Dono entra em contato</p>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">Ele responde pelo Backfindr — seu número fica protegido.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-xs font-semibold text-white/50 flex-shrink-0">3</div>
                  <div>
                    <p className="text-white/70 text-sm font-semibold">Vocês combinam a devolução</p>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">Sempre em local público e seguro — a plataforma orienta os dois.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA secundário — sem pressão */}
            <p className="text-center text-white/30 text-xs mb-3">Quer receber avisos se alguém encontrar seus objetos também?</p>
            <Link
              href="/auth/register"
              className="flex items-center justify-center gap-2 bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] text-white/70 font-semibold px-6 py-3 rounded-xl transition-colors text-sm w-full"
            >
              Cadastrar meus objetos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* ── Banner de instrução ── */}
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
                      onClick={() => openLightbox(allPhotos, 0)}
                      className="w-20 h-20 rounded-xl object-cover border border-white/[0.08] flex-shrink-0 cursor-zoom-in"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-4xl flex-shrink-0">
                      {CATEGORY_EMOJI[obj.category] ?? '📦'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/40 text-xs mb-1">{CATEGORY_LABEL[obj.category]}</p>
                    <h1 className="text-xl font-bold text-white leading-tight">{obj.title}</h1>
                    {/* Localização em texto */}
                    {location?.address && (
                      <div className="flex items-center gap-1 mt-2">
                        <MapPin className="w-3 h-3 text-white/30 flex-shrink-0" />
                        <p className="text-white/40 text-xs truncate">{location.address}</p>
                      </div>
                    )}
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

                {/* ── Botão principal ── */}
                <button
                  onClick={notifyOwner}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all text-base"
                  style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.5), 0 8px 24px rgba(20,184,166,0.2)' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  {loading ? 'Enviando aviso...' : 'Avisar o dono que encontrei'}
                </button>

                {/* Nota de privacidade */}
                <div className="flex items-start gap-2.5 mt-4 bg-white/[0.02] rounded-xl p-3">
                  <Shield className="w-4 h-4 text-teal-400/60 flex-shrink-0 mt-0.5" />
                  <p className="text-white/45 text-xs leading-relaxed">
                    <span className="text-white/70 font-medium">Seus dados estão protegidos.</span>{' '}
                    O dono recebe apenas um aviso. Seu nome e telefone não são revelados automaticamente — você decide o que compartilhar.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Mapa ── */}
            {location?.lat && location?.lng && (
              <StaticMap lat={location.lat} lng={location.lng} title={obj.title} />
            )}

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
                      onClick={() => openLightbox(allPhotos, i)}
                      className="w-full aspect-square object-cover rounded-xl border border-white/[0.08] cursor-zoom-in"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Compartilhamento WhatsApp / Instagram / Mais ── */}
            <ShareButtons url={shareUrl} title={obj.title} />

            {/* Promo */}
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
    </>
  );
}
