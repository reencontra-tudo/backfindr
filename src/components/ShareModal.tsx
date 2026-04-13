'use client';
import { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  /** Texto personalizado para o botão que abre o modal */
  buttonLabel?: string;
  /** Classe extra para o botão de abertura */
  buttonClassName?: string;
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

export default function ShareModal({
  url,
  title,
  description = '',
  buttonLabel = 'Compartilhar',
  buttonClassName = '',
}: ShareModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

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

  const openChannel = (channel: Channel) => {
    const shareUrl = channel.getUrl(url, title, description);
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  // Usa Web Share API nativa no mobile se disponível
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch {
        // Usuário cancelou ou não suportado — abre o modal
      }
    }
    setOpen(true);
  };

  return (
    <>
      {/* Botão de abertura */}
      <button
        onClick={handleNativeShare}
        className={buttonClassName || 'flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors'}
      >
        <Share2 className="w-4 h-4" />
        {buttonLabel}
      </button>

      {/* Modal overlay */}
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
