'use client';
// src/app/dashboard/objects/[id]/sucesso/page.tsx

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2, Share2, ArrowRight, QrCode,
  Copy, MessageCircle, Bell, MapPin, Download,
  Instagram, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { objectsApi } from '@/lib/api';

interface ObjectData {
  id: string;
  title: string;
  status: string;
  category: string;
  unique_code?: string;
  qr_code?: string;
  photos?: string[];
  location?: { lat: number; lng: number; address?: string } | string;
  location_city?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  phone: '📱', wallet: '👛', keys: '🔑', bag: '🎒', pet: '🐾',
  bike: '🚲', vehicle: '🚗', document: '📄', jewelry: '💍',
  electronics: '💻', clothing: '👕', other: '📦',
};

const STATUS_MESSAGES: Record<string, { headline: string; sub: string }> = {
  lost:      { headline: 'Alerta publicado na rede!',      sub: 'Você será notificado assim que alguém encontrar.' },
  found:     { headline: 'Achado registrado!',             sub: 'Se o dono procurar, a gente conecta vocês automaticamente.' },
  stolen:    { headline: 'Registro de furto publicado!',   sub: 'Sua ocorrência está visível para toda a rede.' },
  protected: { headline: 'Objeto protegido com QR Code!', sub: 'Cole o QR Code no objeto físico. Se alguém encontrar e escanear, você será notificado imediatamente.' },
};

// Extrai cidade/bairro do objeto para o texto magnético
function extractLocation(obj: ObjectData): string {
  if (obj.location_city) return obj.location_city;
  if (obj.location) {
    try {
      const loc = typeof obj.location === 'string' ? JSON.parse(obj.location) : obj.location;
      if (loc?.address) {
        // Pega apenas a primeira parte do endereço (bairro ou rua)
        const parts = loc.address.split(',');
        return parts[0]?.trim() || '';
      }
    } catch { /* ignora */ }
  }
  return '';
}

// Gera o texto magnético para WhatsApp — soa humano, não como marketing
function buildWhatsAppText(obj: ObjectData): string {
  const location = extractLocation(obj);
  const code = obj.unique_code || obj.qr_code || '';
  const publicUrl = `https://www.backfindr.com/objeto/${code}`;

  if (obj.status === 'protected') {
    return `Colei um QR Code do Backfindr no meu ${obj.title}. Se você encontrar, é só escanear — ele me avisa automaticamente: ${publicUrl}`;
  }

  if (obj.status === 'lost') {
    if (location) {
      return `Gente, perdi meu ${obj.title} perto de ${location}. Cadastrei no Backfindr — se alguém encontrar, o link já identifica o dono: ${publicUrl}`;
    }
    return `Gente, perdi meu ${obj.title}. Cadastrei no Backfindr — se alguém encontrar, o link já identifica o dono: ${publicUrl}`;
  }

  if (obj.status === 'stolen') {
    if (location) {
      return `Roubaram meu ${obj.title} perto de ${location}. Registrei o furto no Backfindr: ${publicUrl}`;
    }
    return `Roubaram meu ${obj.title}. Registrei o furto no Backfindr: ${publicUrl}`;
  }

  // found
  return `Encontrei um objeto perdido${location ? ` perto de ${location}` : ''}. Se for seu, acesse: ${publicUrl}`;
}

// Texto curto para Instagram Stories (máx ~80 chars)
function buildStoriesText(obj: ObjectData): string {
  const location = extractLocation(obj);
  if (obj.status === 'protected') {
    return `Protegi meu ${obj.title} com QR Code 🛡️ ${location ? `em ${location}` : ''}`.trim();
  }
  if (obj.status === 'lost') {
    return location
      ? `Perdi meu ${obj.title} em ${location} 🔍`
      : `Perdi meu ${obj.title} — ajuda a encontrar! 🔍`;
  }
  if (obj.status === 'stolen') {
    return `Roubaram meu ${obj.title}${location ? ` em ${location}` : ''} ⚠️`;
  }
  return `Encontrei um objeto perdido${location ? ` em ${location}` : ''} 📍`;
}

export default function SucessoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obj, setObj] = useState<ObjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [textCopied, setTextCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [justShared, setJustShared] = useState(false);

  useEffect(() => {
    objectsApi.get(id)
      .then(res => setObj(res.data))
      .catch(() => router.push(`/dashboard/objects/${id}`))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!obj) return null;

  const msg = STATUS_MESSAGES[obj.status] ?? STATUS_MESSAGES.lost;
  const emoji = CATEGORY_EMOJI[obj.category] ?? '📦';
  const code = obj.unique_code || obj.qr_code || '';
  const publicUrl = `https://www.backfindr.com/objeto/${code}`;
  const whatsappText = buildWhatsAppText(obj);
  const storiesText = buildStoriesText(obj);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const copyText = async () => {
    await navigator.clipboard.writeText(whatsappText);
    setTextCopied(true);
    toast.success('Texto copiado! Cole no WhatsApp ou Stories.');
    setTimeout(() => setTextCopied(false), 3000);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareInstagram = () => {
    // Copia o texto curto e redireciona para Instagram
    navigator.clipboard.writeText(storiesText + '\n' + publicUrl);
    toast.success('Texto copiado! Cole nos seus Stories.');
    setTimeout(() => {
      window.open('https://www.instagram.com/', '_blank');
    }, 800);
  };

  const downloadPoster = (format: 'square' | 'vertical') => {
    const posterUrl = objectsApi.getPosterUrl(id, format);
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `cartaz-${code}-${format}.png`;
    link.click();
    toast.success(`Cartaz ${format === 'square' ? 'quadrado' : 'vertical'} baixado!`);
  };

  const location = extractLocation(obj);


  const SHARE_NUDGES = [
    { label: 'Compartilhar no WhatsApp', sub: 'Aumenta muito as chances' },
    { label: 'Mandar para mais um grupo', sub: '2 grupos = o dobro de alcance 🚀' },
    { label: 'Mais um grupo — vale muito!', sub: 'Cada grupo tem centenas de pessoas' },
    { label: 'Compartilhar de novo', sub: 'Cada envio aumenta as chances' },
  ];
  const nudge = SHARE_NUDGES[Math.min(shareCount, SHARE_NUDGES.length - 1)];

  const handleWhatsApp = () => {
    setShareCount(c => c + 1);
    setJustShared(true);
    setTimeout(() => setJustShared(false), 2500);
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#080b0f] flex items-center justify-center px-5 py-10">
      {/* Glow de fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20,184,166,0.08) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md relative z-10 text-center">

        {/* ── Confirmação ── */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-teal-400" />
          </div>
        </div>
        <div className="text-5xl mb-4">{emoji}</div>
        <h1 className="text-2xl font-bold text-white mb-2">{msg.headline}</h1>
        <p className="text-white/50 text-sm mb-1">{obj.title}</p>
        {location && (
          <p className="text-white/30 text-xs mb-2 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" />{location}
          </p>
        )}
        <p className="text-white/40 text-sm mb-8 leading-relaxed">{msg.sub}</p>

        {/* ══════════════════════════════════════════════════
            AÇÃO PRINCIPAL — WhatsApp em destaque máximo
            O botão precisa ser a primeira coisa que o
            usuário vê e clica — no pico da ansiedade.
        ═══════════════════════════════════════════════════ */}
        <div className="mb-6">
          {/* Label de urgência */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-teal-400 text-xs font-semibold uppercase tracking-wider">
              {nudge.sub}
            </span>
          </div>

          {/* Botão WhatsApp — loop progressivo */}
          {shareCount > 0 && (
            <div className={`flex items-center justify-center gap-2 mb-4 transition-all duration-500 ${justShared ? 'scale-110' : 'scale-100'}`}>
              <div className="flex gap-1.5">
                {[1, 2, 3].map(n => (
                  <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${shareCount >= n ? 'bg-green-500 text-white scale-110' : 'bg-white/[0.06] text-white/30 border border-white/10'}`}>
                    {shareCount >= n ? '✓' : n}
                  </div>
                ))}
              </div>
              <span className="text-white/50 text-xs">{shareCount === 1 ? '1 grupo atingido' : `${shareCount} grupos atingidos`}</span>
            </div>
          )}
          {justShared && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 mb-3 text-green-400 text-sm font-medium animate-pulse">
              ✅ Enviado! Manda para mais um grupo?
            </div>
          )}
          <button
            onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base text-white transition-all mb-3"
            style={{
              background: 'linear-gradient(135deg, #25D366 0%, #20b954 100%)',
              boxShadow: '0 0 0 1px rgba(37,211,102,0.4), 0 8px 32px rgba(37,211,102,0.25)',
            }}
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            {nudge.label}
          </button>

          {/* Preview do texto que vai ser enviado */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 mb-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <p className="text-white/50 text-xs leading-relaxed flex-1 italic">
                &ldquo;{whatsappText}&rdquo;
              </p>
              <button
                onClick={copyText}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors bg-teal-500/10 hover:bg-teal-500/20 px-2.5 py-1.5 rounded-lg border border-teal-500/20"
              >
                {textCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {textCopied ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
          </div>

          {/* Stories + Copiar link */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={shareInstagram}
              className="flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white text-sm py-3 rounded-xl transition-all"
            >
              <Instagram className="w-4 h-4" />
              Para Stories
            </button>
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white text-sm py-3 rounded-xl transition-all"
            >
              {linkCopied ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Copiado!' : 'Copiar link'}
            </button>
          </div>
        </div>

        {/* ── Próximos passos ── */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-4 text-left">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Próximos passos</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageCircle className="w-3.5 h-3.5 text-green-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Compartilhe em grupos do WhatsApp</p>
                <p className="text-white/40 text-xs">Esta é a ação que normalmente aumenta mais rapidamente as chances de alguém reconhecer seu objeto.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Ative as notificações</p>
                <p className="text-white/40 text-xs">Alerta imediato quando alguém escanear o QR ou encontrar um match.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <QrCode className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Baixe o cartaz ou QR Code</p>
                <p className="text-white/40 text-xs">Imprima e cole na mochila, carteira, coleira ou documento.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Veja no mapa público</p>
                <p className="text-white/40 text-xs">Seu registro já está visível para toda a rede.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Download de cartaz ── */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-6 text-left">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Baixar cartaz</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadPoster('square')}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Quadrado
            </button>
            <button
              onClick={() => downloadPoster('vertical')}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 text-xs font-medium py-2.5 rounded-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Vertical
            </button>
          </div>
        </div>

        {/* ── Boost — oferta contextual pós-cadastro ── */}
        {(obj.status === 'lost' || obj.status === 'stolen') && (
          <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-5 mb-4 text-left">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-2xl">⚡</div>
              <div>
                <p className="text-amber-300 text-sm font-bold mb-0.5">Quer aumentar as chances?</p>
                <p className="text-white/40 text-xs leading-relaxed">
                  Objetos com impulso aparecem para mais pessoas na região. A decisão é sua — mas quanto antes, melhor.
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/objects/${id}#boost`}
              className="w-full flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-sm font-semibold py-3 rounded-xl transition-all"
            >
              Ver opções de alcance — a partir de R$ 9,90
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── Monetização — só para lost/stolen ── */}
        {(obj.status === 'lost' || obj.status === 'stolen') && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-semibold">Quer ampliar ainda mais suas chances?</h3>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Seu cadastro já está publicado gratuitamente. Se desejar alcançar ainda mais pessoas próximas, você pode aumentar a exposição da ocorrência.
            </p>
            <Link
              href={`/dashboard/objects/${id}`}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all"
            >
              Ampliar alcance da ocorrência
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ── Navegação ── */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/dashboard/objects/${id}`}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl transition-all text-base"
            style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.4), 0 4px 20px rgba(20,184,166,0.15)' }}
          >
            Ver detalhes do objeto
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07] text-white/70 hover:text-white text-sm py-3.5 rounded-xl transition-all"
          >
            Ir para o painel
          </Link>
        </div>

      </div>
    </div>
  );
}
