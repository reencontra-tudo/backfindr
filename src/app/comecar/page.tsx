'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function ComecarPage() {
  return (
    <div className="min-h-screen sm:h-screen overflow-y-auto sm:overflow-hidden bg-[#07090e] text-white selection:bg-teal-500/30">
      <section className="relative flex min-h-screen sm:h-full flex-col items-center justify-center px-5 py-6 sm:py-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 65% at 50% -10%, rgba(19,85,190,.45) 0%, rgba(8,12,20,0) 60%), radial-gradient(ellipse 80% 60% at 70% 25%, rgba(20,184,166,.12) 0%, rgba(7,9,14,0) 55%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="relative mx-auto w-full max-w-3xl text-center">
          <FadeIn>
            <Link href="/" className="mb-4 sm:mb-6 inline-flex items-center gap-2">
              <img src="/icons/logo-backfindr.png" alt="Backfindr" width={26} height={26} style={{ borderRadius: 7 }} />
              <span className="text-sm font-semibold text-white/80">Backfindr</span>
            </Link>

            <p className="mb-3 sm:mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-400/[0.08] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/70">
              Achados, perdidos, roubados e prevenção em um só lugar
            </p>

            <h1
              className="mb-3 font-extrabold leading-[0.96] tracking-[-0.04em] text-white"
              style={{ fontSize: 'clamp(30px, 5vw, 56px)' }}
            >
              O que
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #f87171 0%, #fb923c 40%, #fbbf24 70%, #2dd4bf 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                aconteceu?
              </span>
            </h1>

            <p className="mx-auto mb-2 max-w-xl text-sm sm:text-base font-medium leading-relaxed text-white/70">
              Cada cadastro aumenta uma oportunidade de reencontro.
            </p>

            <p className="mx-auto mb-6 sm:mb-8 max-w-xl text-sm text-white/45">
              Escolha uma opção para começar.
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-5 sm:mb-6">
              <Link
                href="/flow/lost"
                className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/[0.1] px-3.5 py-5 text-center transition-all hover:border-red-500/70 hover:bg-red-500/[0.18] hover:scale-[1.02] after:content-[''] after:absolute after:-inset-1.5"
                style={{ boxShadow: '0 0 0 1px rgba(239,68,68,0.15), 0 8px 32px rgba(239,68,68,0.08)' }}
              >
                <span className="text-[1.7rem]">😟</span>
                <div>
                  <p className="text-[0.9rem] font-bold text-white leading-tight">Perdi alguma coisa</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Cadastre agora (leva menos de 30 segundos)</p>
                </div>
                <ArrowRight className="h-4 w-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href="/flow/found"
                className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-teal-500/40 bg-teal-500/[0.1] px-3.5 py-5 text-center transition-all hover:border-teal-500/70 hover:bg-teal-500/[0.18] hover:scale-[1.02] after:content-[''] after:absolute after:-inset-1.5"
                style={{ boxShadow: '0 0 0 1px rgba(20,184,166,0.15), 0 8px 32px rgba(20,184,166,0.08)' }}
              >
                <span className="text-[1.7rem]">🙌</span>
                <div>
                  <p className="text-[0.9rem] font-bold text-white leading-tight">Encontrei alguma coisa</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Ajude a encontrar o dono</p>
                </div>
                <ArrowRight className="h-4 w-4 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href="/flow/stolen"
                className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-orange-500/40 bg-orange-500/[0.1] px-3.5 py-5 text-center transition-all hover:border-orange-500/70 hover:bg-orange-500/[0.18] hover:scale-[1.02] after:content-[''] after:absolute after:-inset-1.5"
                style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.15), 0 8px 32px rgba(249,115,22,0.08)' }}
              >
                <span className="text-[1.7rem]">🚨</span>
                <div>
                  <p className="text-[0.9rem] font-bold text-white leading-tight">Foi roubado</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Cadastre e aumente as oportunidades de recuperação</p>
                </div>
                <ArrowRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href="/flow/protect"
                className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-blue-500/40 bg-blue-500/[0.1] px-3.5 py-5 text-center transition-all hover:border-blue-500/70 hover:bg-blue-500/[0.18] hover:scale-[1.02] after:content-[''] after:absolute after:-inset-1.5"
                style={{ boxShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 8px 32px rgba(59,130,246,0.08)' }}
              >
                <span className="text-[1.7rem]">🔒</span>
                <div>
                  <p className="text-[0.9rem] font-bold text-white leading-tight">Quero me prevenir</p>
                  <p className="text-xs text-white/45 mt-1 leading-tight">Proteja seus bens antes de perder</p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>

            <div className="flex flex-col items-center gap-2.5 sm:gap-3">
              <Link
                href="/map"
                className="relative inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm text-white/60 transition-all hover:border-white/[0.2] hover:text-white/90 after:content-[''] after:absolute after:-inset-1.5"
              >
                <MapPin className="h-4 w-4 text-teal-400" />
                Ver ocorrências próximas
              </Link>
              <p className="text-xs text-white/28">+4.300 pessoas já utilizam o Backfindr</p>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
