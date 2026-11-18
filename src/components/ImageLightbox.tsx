'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { abrirEntradaLightbox, decidirDeslize } from '@/lib/lightboxHistorico';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [loaded, setLoaded] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const prev = useCallback(() => {
    setLoaded(false);
    setCurrent((c) => (c - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setLoaded(false);
    setCurrent((c) => (c + 1) % images.length);
  }, [images.length]);

  // Fechar com ESC, navegar com setas
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && images.length > 1) prev();
      if (e.key === 'ArrowRight' && images.length > 1) next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next, images.length]);

  // Gesto/botão de voltar do aparelho fecha só a foto (ver src/lib/lightboxHistorico.ts).
  useEffect(() => abrirEntradaLightbox(() => onCloseRef.current()), []);

  // Bloquear scroll do body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Deslizar para passar de foto (celular). Só com 2+ fotos e fora da borda esquerda (gesto de voltar do iOS); o sistema pode cancelar o toque.
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const acao = decidirDeslize(
      { x: touchStartX.current, y: touchStartY.current },
      { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY },
      images.length,
    );
    if (acao === 'proxima') next(); else if (acao === 'anterior') prev();
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleTouchCancel = () => { touchStartX.current = null; touchStartY.current = null; };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Botão fechar */}
      <button
        onClick={onClose}
        className="bf-lightbox-fechar absolute right-4 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white"
        style={{ background: 'rgba(255,255,255,0.25)' }}
        aria-label="Fechar"
        data-lightbox-fechar
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5l10 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Contador */}
      {images.length > 1 && (
        <div
          className="bf-lightbox-fechar absolute left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-sm text-white font-medium"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          {current + 1} / {images.length}
        </div>
      )}

      {/* Seta esquerda */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={{ background: 'rgba(255,255,255,0.15)' }}
          aria-label="Anterior"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-8 6 8 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Imagem principal */}
      <div
        className="relative flex items-center justify-center"
        style={{ maxWidth: '92vw', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spinner enquanto carrega */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current}
          src={images[current]}
          alt={`Foto ${current + 1}`}
          onLoad={() => setLoaded(true)}
          className="rounded-xl shadow-2xl object-contain transition-opacity duration-200"
          style={{
            maxWidth: '92vw',
            maxHeight: '88vh',
            opacity: loaded ? 1 : 0,
            display: 'block',
          }}
          draggable={false}
        />
      </div>

      {/* Seta direita */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={{ background: 'rgba(255,255,255,0.15)' }}
          aria-label="Próxima"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4l8 6-8 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Miniaturas (thumbnails) quando há múltiplas fotos */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => { setLoaded(false); setCurrent(i); }}
              className="rounded-lg object-cover cursor-pointer transition-all duration-150"
              style={{
                width: 44,
                height: 44,
                border: i === current ? '2px solid white' : '2px solid rgba(255,255,255,0.25)',
                opacity: i === current ? 1 : 0.55,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Hook auxiliar para usar o lightbox facilmente
export function useLightbox() {
  const [state, setState] = useState<{ images: string[]; index: number } | null>(null);

  const open = useCallback((images: string[], index = 0) => {
    setState({ images, index });
  }, []);

  const close = useCallback(() => setState(null), []);

  return { open, close, lightbox: state };
}
