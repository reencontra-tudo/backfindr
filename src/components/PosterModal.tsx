'use client';

import { useState } from 'react';
import { X, Download, ImageIcon, Loader2, Instagram, MessageCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface PosterModalProps {
  objectId: string;
  objectCode: string;
  objectTitle: string;
  onClose: () => void;
}

type Format = 'square' | 'vertical' | 'a4';

const FORMATS: { id: Format; label: string; desc: string; icon: React.ReactNode; ratio: string; size: string }[] = [
  {
    id: 'square',
    label: 'Quadrado',
    desc: 'Feed do Instagram e Facebook',
    icon: <Instagram className="w-4 h-4" />,
    ratio: '1:1',
    size: '1080×1080',
  },
  {
    id: 'vertical',
    label: 'Vertical',
    desc: 'Stories e grupos de WhatsApp',
    icon: <MessageCircle className="w-4 h-4" />,
    ratio: '9:16',
    size: '1080×1920',
  },
  {
    id: 'a4',
    label: 'A4 Retrato',
    desc: 'Imprimir e colar na rua',
    icon: <FileText className="w-4 h-4" />,
    ratio: 'A4',
    size: '2480×3508',
  },
];

export default function PosterModal({ objectId, objectCode, objectTitle, onClose }: PosterModalProps) {
  const [format, setFormat]         = useState<Format>('square');
  // loadingFormat: qual botão de formato está gerando a prévia
  const [loadingFormat, setLoadingFormat] = useState<Format | null>(null);
  const [downloading, setDownloading]     = useState(false);
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);
  // imageLoading: true enquanto o <img> ainda não terminou de carregar
  const [imageLoading, setImageLoading]   = useState(false);

  const posterUrl = (fmt: Format) =>
    `/api/v1/objects/${objectId}/poster?format=${fmt}`;

  const handleFormat = async (fmt: Format) => {
    if (loadingFormat === fmt) return; // evita clique duplo
    setFormat(fmt);
    setLoadingFormat(fmt);
    setPreviewUrl(null);
    setImageLoading(true);
    // Pré-busca a URL para garantir que o servidor gerou a imagem antes de exibir
    try {
      const res = await fetch(posterUrl(fmt));
      if (!res.ok) throw new Error('Erro ao gerar prévia');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      toast.error('Não foi possível gerar a prévia.');
      setImageLoading(false);
    } finally {
      setLoadingFormat(null);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
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
    } catch {
      toast.error('Não foi possível gerar o cartaz. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const selectedFmt = FORMATS.find((f) => f.id === format)!;

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
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const isActive   = format === f.id;
                const isGenerating = loadingFormat === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => handleFormat(f.id)}
                    disabled={!!loadingFormat}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all text-left relative overflow-hidden ${
                      isActive
                        ? 'border-teal-500/50 bg-teal-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
                    } disabled:opacity-60`}
                  >
                    {isGenerating ? (
                      /* Estado de loading: substitui TODO o conteúdo do botão */
                      <div className="flex flex-col items-center justify-center gap-1 py-1">
                        <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                        <span className="text-teal-300 text-[10px] font-semibold">gerando…</span>
                      </div>
                    ) : (
                      /* Estado normal */
                      <>
                        <div className="flex items-center justify-between">
                          <div className={`${isActive ? 'text-teal-400' : 'text-white/40'}`}>
                            {f.icon}
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                            isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-white/30'
                          }`}>
                            {f.ratio}
                          </span>
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-white/60'}`}>
                            {f.label}
                          </p>
                          <p className="text-white/30 text-[10px] mt-0.5 leading-tight">{f.desc}</p>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Pré-visualização
            </p>
            <div
              className={`relative bg-[#080b0f] rounded-xl overflow-hidden border border-white/[0.06] flex items-center justify-center ${
                format === 'vertical' ? 'aspect-[9/16]'
                : format === 'a4'     ? 'aspect-[210/297]'
                : 'aspect-square'
              }`}
            >
              {/* Loading enquanto o botão de formato está gerando ou a imagem ainda carrega */}
              {(loadingFormat || imageLoading) && !previewUrl ? (
                <div className="flex flex-col items-center gap-2 text-white/30">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Gerando cartaz…</span>
                </div>
              ) : previewUrl ? (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080b0f] gap-2 text-white/30 z-10">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-xs">Gerando cartaz…</span>
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Prévia do cartaz"
                    className="w-full h-full object-contain"
                    onLoad={() => setImageLoading(false)}
                    onError={() => { setPreviewUrl(null); setImageLoading(false); }}
                  />
                </>
              ) : (
                <button
                  onClick={() => handleFormat(format)}
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
            disabled={downloading || !!loadingFormat}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-white font-bold rounded-xl transition-all text-sm"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando cartaz…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar cartaz ({selectedFmt.size})
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
