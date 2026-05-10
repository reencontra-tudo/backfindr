'use client';

import { useState } from 'react';
import { X, Download, ImageIcon, Loader2, Instagram, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PosterModalProps {
  objectId: string;
  objectCode: string;
  objectTitle: string;
  onClose: () => void;
}

type Format = 'square' | 'vertical';

const FORMATS: { id: Format; label: string; desc: string; icon: React.ReactNode; ratio: string }[] = [
  {
    id: 'square',
    label: 'Quadrado',
    desc: 'Feed do Instagram e Facebook',
    icon: <Instagram className="w-4 h-4" />,
    ratio: '1:1',
  },
  {
    id: 'vertical',
    label: 'Vertical',
    desc: 'Stories e grupos de WhatsApp',
    icon: <MessageCircle className="w-4 h-4" />,
    ratio: '9:16',
  },
];

export default function PosterModal({ objectId, objectCode, objectTitle, onClose }: PosterModalProps) {
  const [format, setFormat]         = useState<Format>('square');
  const [loading, setLoading]       = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const posterUrl = (fmt: Format) =>
    `/api/v1/objects/${objectId}/poster?format=${fmt}`;

  const handlePreview = async (fmt: Format) => {
    setPreviewing(true);
    setPreviewUrl(null);
    try {
      // Gerar preview via URL — o browser carrega a imagem diretamente
      setPreviewUrl(posterUrl(fmt));
    } finally {
      setPreviewing(false);
    }
  };

  const handleFormat = (fmt: Format) => {
    setFormat(fmt);
    handlePreview(fmt);
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(posterUrl(format));
      if (!res.ok) throw new Error('Falha ao gerar cartaz');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `cartaz-${objectCode}-${format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Cartaz baixado!');
    } catch (err) {
      toast.error('Não foi possível gerar o cartaz. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-[#0f1318] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Gerar Cartaz</p>
              <p className="text-white/40 text-xs truncate max-w-[200px]">{objectTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Seletor de formato */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Formato
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFormat(f.id)}
                  className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left ${
                    format === f.id
                      ? 'border-teal-500/50 bg-teal-500/10'
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`${format === f.id ? 'text-teal-400' : 'text-white/40'}`}>
                      {f.icon}
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                      format === f.id ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-white/30'
                    }`}>
                      {f.ratio}
                    </span>
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${format === f.id ? 'text-white' : 'text-white/60'}`}>
                      {f.label}
                    </p>
                    <p className="text-white/35 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Pré-visualização
            </p>
            <div
              className={`relative bg-[#080b0f] rounded-xl overflow-hidden border border-white/[0.06] flex items-center justify-center ${
                format === 'vertical' ? 'aspect-[9/16]' : 'aspect-square'
              }`}
            >
              {previewing ? (
                <div className="flex flex-col items-center gap-2 text-white/30">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Gerando prévia…</span>
                </div>
              ) : previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt="Prévia do cartaz"
                  className="w-full h-full object-contain"
                  onError={() => setPreviewUrl(null)}
                />
              ) : (
                <button
                  onClick={() => handlePreview(format)}
                  className="flex flex-col items-center gap-2 text-white/30 hover:text-white/50 transition-colors"
                >
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs">Clique para ver a prévia</span>
                </button>
              )}
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-white/[0.03] rounded-xl p-4 space-y-1.5">
            <p className="text-white/50 text-xs font-semibold">Como usar:</p>
            <p className="text-white/35 text-xs leading-relaxed">
              Baixe o cartaz e publique em grupos do WhatsApp, Facebook, Instagram ou imprima para colar na sua região. O QR Code leva diretamente à página do objeto.
            </p>
          </div>

          {/* Botão de download */}
          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-white font-bold rounded-xl transition-all text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando cartaz…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar cartaz ({format === 'square' ? '1080×1080' : '1080×1920'})
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
