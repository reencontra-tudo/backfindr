'use client';

/**
 * RecoveredCelebration
 * Componente de celebração disparado quando um objeto é marcado como devolvido.
 *
 * Usado em:
 *   - dashboard/objects/[id]/page.tsx   → substitui o modal showRecoveredModal
 *   - scan/[code]/client.tsx            → tela pública "objeto já recuperado"
 *   - objeto/[code]/client.tsx          → tela pública "objeto já recuperado"
 *
 * Props:
 *   objectTitle   — nome do objeto recuperado
 *   objectEmoji   — emoji da categoria (ex: '📱', '🔑')
 *   objectCode    — código único para link público (opcional — omitir na view pública)
 *   mode          — 'modal' (overlay sobre o dashboard) | 'page' (tela cheia pública)
 *   onClose       — callback para fechar o modal (só em mode='modal')
 */

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Share2, Copy, MessageCircle, Instagram, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface RecoveredCelebrationProps {
  objectTitle: string;
  objectEmoji?: string;
  objectCode?: string;
  mode?: 'modal' | 'page';
  onClose?: () => void;
}

// ─── Confetti particle ─────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  shape: 'rect' | 'circle' | 'strip';
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
}

const CONFETTI_COLORS = [
  '#14b8a6', '#2dd4bf', // teal
  '#fb923c', '#fbbf24', // amber/orange
  '#f87171',             // red
  '#a78bfa',             // violet
  '#34d399',             // green
  '#60a5fa',             // blue
  '#ffffff',             // white
];

function useConfetti(active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const burstCountRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function burst(x: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 4 + Math.random() * 8;
        particlesRef.current.push({
          id: Math.random(),
          x,
          y: canvas!.height * 0.4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          shape: (['rect', 'circle', 'strip'] as const)[Math.floor(Math.random() * 3)],
          size: 6 + Math.random() * 8,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          opacity: 1,
          decay: 0.012 + Math.random() * 0.008,
        });
      }
    }

    // 3 bursts em sequência
    burst(canvas.width * 0.5, 55);
    setTimeout(() => burst(canvas.width * 0.25, 40), 220);
    setTimeout(() => burst(canvas.width * 0.75, 40), 380);

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.02);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.99; // drag
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'strip') {
          ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return canvasRef;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RecoveredCelebration({
  objectTitle,
  objectEmoji = '📦',
  objectCode,
  mode = 'modal',
  onClose,
}: RecoveredCelebrationProps) {
  const [visible, setVisible] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const canvasRef = useConfetti(visible);

  const publicUrl = objectCode
    ? `https://www.backfindr.com/objeto/${objectCode}`
    : 'https://www.backfindr.com';

  const shareText = `🎉 Recuperei meu "${objectTitle}" com o Backfindr! Cadastre seus objetos em backfindr.com e nunca mais perca algo sem chance de recuperar.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const instagramCopyText = shareText; // Instagram não tem deep link de share, copia o texto

  useEffect(() => {
    // Pequeno delay para a animação de entrada
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(() => onClose?.(), 300);
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  }

  function copyInstagram() {
    navigator.clipboard.writeText(instagramCopyText);
    toast.success('Texto copiado — cole nos Stories! 📸');
  }

  // ── Conteúdo interno ────────────────────────────────────────────────────────

  const inner = (
    <div
      className="relative w-full max-w-sm mx-auto"
      style={{
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
      }}
    >
      {/* Canvas de confetti */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl"
        style={{ zIndex: 10 }}
      />

      {/* Card principal */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0d1520 0%, #0a0f18 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(20,184,166,0.15)',
          zIndex: 20,
        }}
      >
        {/* Brilho superior */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(20,184,166,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="px-7 pt-8 pb-7 text-center relative z-10">
          {/* Emoji animado */}
          <div
            className="text-6xl mb-1 inline-block"
            style={{
              animation: visible ? 'celebBounce 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' : 'none',
            }}
          >
            {objectEmoji}
          </div>

          {/* Estrelinhas decorativas */}
          <div className="flex justify-center gap-1 mb-4" aria-hidden>
            {['✦', '✦', '✦'].map((s, i) => (
              <span
                key={i}
                className="text-teal-400 text-xs"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'scale(1)' : 'scale(0)',
                  transition: `opacity 0.3s ${0.5 + i * 0.08}s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.5 + i * 0.08}s`,
                }}
              >
                {s}
              </span>
            ))}
          </div>

          {/* Título */}
          <h2
            className="font-extrabold text-white mb-1"
            style={{
              fontSize: 'clamp(22px, 5vw, 26px)',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.4s 0.3s, transform 0.4s 0.3s',
            }}
          >
            Está de volta! 🎉
          </h2>

          {/* Nome do objeto */}
          <p
            className="text-white/50 text-sm mb-1"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.4s 0.4s',
            }}
          >
            <span className="text-teal-400 font-semibold">{objectTitle}</span> foi recuperado.
          </p>

          {/* Frase motivacional */}
          <p
            className="text-white/30 text-xs leading-relaxed mb-6"
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.4s 0.5s',
            }}
          >
            Você faz parte de uma rede que já devolveu milhares de objetos.
          </p>

          {/* Divisor */}
          <div className="w-full h-px bg-white/[0.06] mb-5" />

          {/* Compartilhar */}
          {!shareOpen ? (
            <div
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s 0.55s, transform 0.4s 0.55s',
              }}
            >
              <p className="text-white/40 text-xs mb-3">
                Conta para alguém — você pode inspirar quem perdeu algo também.
              </p>
              <button
                onClick={() => setShareOpen(true)}
                className="w-full flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-2xl transition-all"
                style={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                  boxShadow: '0 0 0 1px rgba(20,184,166,0.4), 0 6px 20px rgba(20,184,166,0.2)',
                  color: '#fff',
                }}
              >
                <Share2 className="w-4 h-4" />
                Compartilhar a história
              </button>
            </div>
          ) : (
            <div
              className="space-y-2"
              style={{
                opacity: visible ? 1 : 0,
                animation: 'fadeSlideUp 0.3s ease both',
              }}
            >
              <p className="text-white/40 text-xs mb-3">Escolha onde compartilhar:</p>

              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold text-white"
                style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}
              >
                <MessageCircle className="w-4 h-4 text-[#25D366] flex-shrink-0" />
                <span className="flex-1 text-left">WhatsApp</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              </a>

              {/* X / Twitter */}
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <X className="w-4 h-4 text-white/70 flex-shrink-0" />
                <span className="flex-1 text-left">X (Twitter)</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/30" />
              </a>

              {/* Instagram */}
              <button
                onClick={copyInstagram}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold text-white"
                style={{ background: 'rgba(214,73,175,0.1)', border: '1px solid rgba(214,73,175,0.2)' }}
              >
                <Instagram className="w-4 h-4 text-[#E1306C] flex-shrink-0" />
                <span className="flex-1 text-left">Instagram (copiar texto)</span>
                <Copy className="w-3.5 h-3.5 text-white/30" />
              </button>

              {/* Copiar link */}
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium text-white/60"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Copy className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">Copiar link do objeto</span>
              </button>
            </div>
          )}

          {/* Fechar */}
          {mode === 'modal' && (
            <button
              onClick={handleClose}
              className="w-full mt-4 text-white/25 hover:text-white/50 text-xs py-1.5 transition-colors"
            >
              Fechar
            </button>
          )}

          {mode === 'page' && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-5 text-teal-400 hover:text-teal-300 text-xs transition-colors"
            >
              Conhecer o Backfindr <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes celebBounce {
          0%   { transform: scale(0.3) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(8deg); opacity: 1; }
          80%  { transform: scale(0.92) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  // ── Mode: modal ─────────────────────────────────────────────────────────────
  if (mode === 'modal') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-5"
        style={{
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        {inner}
      </div>
    );
  }

  // ── Mode: page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080b0f] flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(20,184,166,0.1) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 w-full">
        {inner}
      </div>
    </div>
  );
}
