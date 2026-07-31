'use client';
import { useState } from 'react';
import { X, Copy, Check, Share2, MessageSquareQuote } from 'lucide-react';
import { toast } from 'sonner';
import { buildWhatsAppShareText } from '@/lib/shareText';

interface ShareModalProps {
  /** URL usada pelos canais genéricos (Facebook, X, Telegram, LinkedIn, Email, Copiar link) */
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  /** Texto personalizado para o botão que abre o modal */
  buttonLabel?: string;
  /** Classe extra para o botão de abertura */
  buttonClassName?: string;
  /** URL canônica do objeto para o texto magnético (WhatsApp direto / Web Share API). Default: `url`. */
  shareUrl?: string;
  /**
   * Status do objeto (lost/stolen/found/protected) — habilita o texto magnético
   * gerado por shareText.ts. Sem isso, usa um fallback genérico com título + link.
   */
  status?: string;
  location?: { address?: string } | string | null | undefined;
  location_city?: string;
}

interface Channel {
  name: string;
  icon: string;
  color: string;
  getUrl: (url: string, title: string, description: string) => string;
}

const CHANNELS: Channel[] = [
  {
    name: 'WhatsApp',
    icon: '💬',
    color: '#25D366',
    getUrl: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    getUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: 'X (Twitter)',
    icon: '🐦',
    color: '#000000',
    getUrl: (url, title) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Telegram',
    icon: '✈️',
    color: '#26A5E4',
    getUrl: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    getUrl: (url, title, description) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`,
  },
  {
    name: 'Email',
    icon: '📧',
    color: '#6B7280',
    getUrl: (url, title, description) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${description}\n\n${url}`)}`,
  },
];

// Nota: Instagram e TikTok não possuem API de compartilhamento web.
// A estratégia é copiar o link + abrir o app, orientando o usuário a colar nos Stories/Bio.
const COPY_CHANNELS = [
  {
    name: 'Instagram',
    icon: '📸',
    color: '#E1306C',
    hint: 'Cole nos Stories ou Bio',
  },
  {
    name: 'TikTok',
    icon: '🎵',
    color: '#FF0050',
    hint: 'Cole na bio ou no vídeo',
  },
];

// Facebook bloqueia preenchimento automático de legenda via URL desde 2018
// (limitação anti-spam da própria Meta) — copiamos a legenda pro usuário
// colar manualmente, em vez de fingir que dá pra automatizar.
const FACEBOOK_NO_CAPTION_HINT = 'Legenda copiada — o Facebook não permite preencher automaticamente, é só colar na publicação';

function appendVia(url: string, via: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}via=${via}`;
}

export default function ShareModal({
  url,
  title,
  description = '',
  buttonLabel = 'Compartilhar',
  buttonClassName = '',
  shareUrl,
  status,
  location,
  location_city,
}: ShareModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [legendCopied, setLegendCopied] = useState(false);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  const baseShareUrl = shareUrl ?? url;

  // Texto magnético por canal — cada um carrega seu próprio ?via= para
  // diferenciar a origem no Events.sharedLinkOpened.
  const buildText = (via: string) => {
    const urlWithVia = appendVia(baseShareUrl, via);
    return status
      ? buildWhatsAppShareText({ title, status, location, location_city }, urlWithVia)
      : `${title}\n${urlWithVia}`;
  };
  const whatsappText = buildText('whatsapp_share');
  const nativeShareText = buildText('native_share');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const copyLegend = async () => {
    try {
      await navigator.clipboard.writeText(nativeShareText);
      setLegendCopied(true);
      toast.success('Legenda copiada! Cole onde quiser compartilhar.');
      setTimeout(() => setLegendCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar a legenda.');
    }
  };

  const copyForChannel = async (channelName: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedChannel(channelName);
      toast.success(`Link copiado! Cole no ${channelName}.`);
      setTimeout(() => setCopiedChannel(null), 2500);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const openChannel = async (channel: Channel) => {
    if (channel.name === 'WhatsApp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener,noreferrer,width=600,height=500');
      return;
    }
    if (channel.name === 'Facebook') {
      // Copia a legenda antes de abrir — Meta bloqueia preenchimento automático
      try {
        await navigator.clipboard.writeText(nativeShareText);
        toast.info(FACEBOOK_NO_CAPTION_HINT, { duration: 5000 });
      } catch {
        // Segue mesmo se a cópia falhar — o compartilhamento em si não depende disso
      }
    }
    const shareUrlForChannel = channel.getUrl(url, title, description);
    window.open(shareUrlForChannel, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  // Usa Web Share API nativa no mobile se disponível
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // Quando há texto magnético, o link já vai embutido em `text` —
        // não repassar `url` separadamente evita o link aparecer duplicado
        // nos apps que concatenam text+url (comum no Android).
        if (status) {
          await navigator.share({ title, text: nativeShareText });
        } else {
          await navigator.share({ title, text: description, url: appendVia(baseShareUrl, 'native_share') });
        }
        return;
      } catch {
        // Usuário cancelou ou não suportado — abre o modal
      }
    }
    setOpen(true);
  };

  return (
    <>
      {/* Botão de abertura — dispara Web Share API nativa quando disponível */}
      <button
        onClick={handleNativeShare}
        className={buttonClassName || 'flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors'}
      >
        <Share2 className="w-4 h-4" />
        {buttonLabel}
      </button>

      {/* Modal overlay — fallback para quando a Web Share API não está disponível
          (a maioria dos navegadores desktop) ou o usuário cancelou o menu nativo */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm bg-[#111418] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-white font-semibold text-[15px]">Compartilhar</p>
                <p className="text-white/30 text-xs mt-0.5 truncate max-w-[220px]">{title}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Copiar legenda — texto pronto pra colar em qualquer app */}
            <div className="px-5 pt-4">
              <button
                onClick={copyLegend}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/20 transition-all active:scale-[0.99] text-left"
              >
                {legendCopied ? (
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                ) : (
                  <MessageSquareQuote className="w-4 h-4 text-teal-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-teal-300 text-[13px] font-medium">
                    {legendCopied ? 'Legenda copiada!' : 'Copiar legenda'}
                  </p>
                  <p className="text-white/30 text-[11px] truncate">Texto pronto pra colar em qualquer app</p>
                </div>
              </button>
            </div>

            {/* Canais com API web */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-white/30 text-[11px] uppercase tracking-wider mb-3">Compartilhar via</p>
              <div className="grid grid-cols-3 gap-3">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.name}
                    onClick={() => openChannel(ch)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all active:scale-95"
                  >
                    <span className="text-2xl">{ch.icon}</span>
                    <span className="text-white/60 text-[11px] text-center leading-tight">{ch.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-white/20 text-[10px] mt-2.5 leading-relaxed">
                No Facebook, a legenda é copiada automaticamente — o Facebook não permite preenchimento automático.
              </p>
            </div>

            {/* Canais que precisam de cópia manual (Instagram, TikTok) */}
            <div className="px-5 pt-2 pb-3">
              <p className="text-white/30 text-[11px] uppercase tracking-wider mb-3">Copiar link para</p>
              <div className="grid grid-cols-2 gap-3">
                {COPY_CHANNELS.map((ch) => (
                  <button
                    key={ch.name}
                    onClick={() => copyForChannel(ch.name)}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all active:scale-95"
                  >
                    <span className="text-xl">{ch.icon}</span>
                    <div className="text-left">
                      <p className="text-white/70 text-[12px] font-medium">{ch.name}</p>
                      <p className="text-white/25 text-[10px]">{ch.hint}</p>
                    </div>
                    {copiedChannel === ch.name && (
                      <Check className="w-3.5 h-3.5 text-teal-400 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Copiar link */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5">
                <span className="text-white/30 text-xs truncate flex-1 font-mono">{url}</span>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
