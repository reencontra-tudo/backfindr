'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface TourStep {
  /** Seletor CSS do elemento a destacar (null = modal centralizado) */
  target: string | null;
  title: string;
  description: string;
  /** Posição preferida do tooltip em relação ao elemento */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // padding ao redor do spotlight

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getElementRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltipStyle(
  rect: Rect | null,
  placement: TourStep['placement'],
  tooltipRef: React.RefObject<HTMLDivElement | null>
): React.CSSProperties {
  if (!rect || placement === 'center') {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '340px',
      width: 'calc(100vw - 32px)',
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = tooltipRef.current?.offsetWidth ?? 320;
  const th = tooltipRef.current?.offsetHeight ?? 200;

  let top = 0;
  let left = 0;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  switch (placement) {
    case 'bottom':
      top = rect.top + rect.height + PAD + 8;
      left = Math.max(16, Math.min(cx - tw / 2, vw - tw - 16));
      break;
    case 'top':
      top = rect.top - th - PAD - 8;
      left = Math.max(16, Math.min(cx - tw / 2, vw - tw - 16));
      break;
    case 'right':
      top = Math.max(16, Math.min(cy - th / 2, vh - th - 16));
      left = rect.left + rect.width + PAD + 8;
      break;
    case 'left':
      top = Math.max(16, Math.min(cy - th / 2, vh - th - 16));
      left = rect.left - tw - PAD - 8;
      break;
    default: // bottom fallback
      top = rect.top + rect.height + PAD + 8;
      left = Math.max(16, Math.min(cx - tw / 2, vw - tw - 16));
  }

  // Ajuste se sair da viewport
  if (top < 16) top = 16;
  if (top + th > vh - 16) top = vh - th - 16;
  if (left < 16) left = 16;
  if (left + tw > vw - 16) left = vw - tw - 16;

  return { position: 'fixed', top, left, maxWidth: '340px', width: 'calc(100vw - 32px)' };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingTour({ steps, onComplete, onSkip }: OnboardingTourProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const step = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const isFirst = currentIndex === 0;

  const measureAndPosition = useCallback(() => {
    if (!step) return;
    const r = step.target ? getElementRect(step.target) : null;
    setRect(r);
    // Scroll para o elemento se necessário
    if (r) {
      const el = document.querySelector(step.target!);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    measureAndPosition();
    window.addEventListener('resize', measureAndPosition);
    return () => window.removeEventListener('resize', measureAndPosition);
  }, [measureAndPosition]);

  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipStyle(computeTooltipStyle(rect, step?.placement ?? 'bottom', tooltipRef));
    }
  }, [rect, step]);

  function goNext() {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  function goPrev() {
    if (!isFirst) setCurrentIndex(i => i - 1);
  }

  function handleComplete() {
    setVisible(false);
    setTimeout(onComplete, 300);
  }

  function handleSkip() {
    setVisible(false);
    setTimeout(onSkip, 300);
  }

  if (!step) return null;

  const spotlightRect = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* ── Overlay com buraco (spotlight) ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'normal' }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* Fundo branco = visível (escurecido) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Buraco = transparente (spotlight) */}
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#spotlight-mask)"
        />
        {/* Borda teal ao redor do spotlight */}
        {spotlightRect && (
          <rect
            x={spotlightRect.left}
            y={spotlightRect.top}
            width={spotlightRect.width}
            height={spotlightRect.height}
            rx="12"
            fill="none"
            stroke="rgba(20,184,166,0.6)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Clique fora fecha */}
      <div className="absolute inset-0" onClick={handleSkip} />

      {/* ── Tooltip ── */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="z-10 bg-[#0b1120] border border-white/[0.10] rounded-2xl shadow-2xl p-5 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-4 h-1.5 bg-teal-400'
                    : i < currentIndex
                    ? 'w-1.5 h-1.5 bg-teal-600'
                    : 'w-1.5 h-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <p className="text-white font-semibold text-sm">{step.title}</p>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>
        </div>

        {/* Navegação */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-white/30 hover:text-white/50 text-xs transition-colors"
          >
            Pular tour
          </button>

          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white text-xs transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-xs font-semibold transition-all"
              style={{ boxShadow: '0 0 12px rgba(20,184,166,0.3)' }}
            >
              {isLast ? 'Concluir' : 'Próximo'}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Contador */}
        <p className="text-center text-white/20 text-[10px] mt-3">
          {currentIndex + 1} de {steps.length}
        </p>
      </div>
    </div>
  );
}
