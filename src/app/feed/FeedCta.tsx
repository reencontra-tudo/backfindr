'use client';
// Acesso ao cadastro no Feed: botões «Perdi algo» / «Encontrei algo» (topo) e o menu «+ Cadastrar ocorrência»
// (botão fixo no celular, no cabeçalho no desktop). SÓ usa fluxos que já existem:
//   Perdi → /flow/lost · Encontrei → /flow/found · Roubaram → /flow/stolen
// Os links existem no HTML do servidor (indexável) e funcionam sem JavaScript; o JavaScript só abre/fecha o menu e mede cliques.
// `?ref=feed` identifica a origem (as páginas /flow/* são noindex, então não geram páginas duplicadas no Google).
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { feedEvents, type FeedCtaPosicao } from '@/lib/feed/analytics';

export const CTA_ROUTES = {
  perdi: '/flow/lost?ref=feed',
  encontrei: '/flow/found?ref=feed',
  roubado: '/flow/stolen?ref=feed',
} as const;

const linkBase = 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-0';

/** Dois botões do topo, lado a lado. */
export function IntroButtons({ pagina }: { pagina: number }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Link href={CTA_ROUTES.perdi} prefetch={false} onClick={() => feedEvents.ctaPerdi('topo', pagina)}
        className={`${linkBase} bg-amber-300 text-[#1a1203] hover:bg-amber-200 focus:ring-amber-100`}>Perdi algo</Link>
      <Link href={CTA_ROUTES.encontrei} prefetch={false} onClick={() => feedEvents.ctaEncontrei('topo', pagina)}
        className={`${linkBase} bg-teal-500 text-[#04110f] hover:bg-teal-400 focus:ring-teal-200`}>Encontrei algo</Link>
    </div>
  );
}

/** Menu «+ Cadastrar ocorrência». variant «fixed» = só celular; «header» = só desktop (sm para cima). */
export function RegisterMenu({ variant, pagina }: { variant: 'fixed' | 'header'; pagina: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const posicao: FeedCtaPosicao = variant === 'fixed' ? 'fixo' : 'cabecalho';
  // Só o botão FIXO (celular): some ao rolar para baixo e volta ao rolar para cima, ao chegar ao topo ou ao receber foco.
  // Com o menu aberto nunca some. No HTML do servidor ele já vem visível (igual para todos).
  const [recolhido, setRecolhido] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;
  useEffect(() => {
    if (variant !== 'fixed') return;
    let ultimo = window.scrollY, ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.max(0, window.scrollY), d = y - ultimo;
        if (y <= 24) setRecolhido(false);                                   // topo
        else if (d > 8 && !openRef.current) { setRecolhido(true); }         // rolando para baixo
        else if (d < -8) setRecolhido(false);                               // rolando para cima
        if (Math.abs(d) > 8 || y <= 24) ultimo = y;
      });
    };
    const onFocus = () => setRecolhido(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    box.current?.addEventListener('focusin', onFocus);
    const el = box.current;
    return () => { window.removeEventListener('scroll', onScroll); el?.removeEventListener('focusin', onFocus); };
  }, [variant]);
  const escondido = variant === 'fixed' && recolhido && !open;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const wrap = variant === 'fixed'
    ? 'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 sm:hidden'   // canto inferior ESQUERDO: o chat fica no direito
    : 'relative hidden sm:block';
  const trigger = variant === 'fixed'
    ? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-teal-400/70 bg-[#10151c]/95 px-4 text-sm font-semibold text-teal-100 shadow-lg shadow-black/40 backdrop-blur hover:bg-[#16202a] focus:outline-none focus:ring-2 focus:ring-teal-300'
    : 'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-[#04110f] hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200';
  const panel = variant === 'fixed'
    ? 'absolute bottom-full left-0 mb-2 w-60'
    : 'absolute right-0 top-full z-40 mt-2 w-60';
  const item = 'flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-300';

  return (
    <div ref={box} data-feed-register={variant} data-recolhido={variant === 'fixed' ? String(escondido) : undefined}
      className={`${wrap}${variant === 'fixed' ? ` transition-transform duration-200 motion-reduce:transition-none ${escondido ? 'pointer-events-none translate-y-[calc(100%+2rem)]' : 'translate-y-0'}` : ''}`}>
      <button type="button" aria-expanded={open} aria-controls={menuId} className={trigger}
        onClick={() => { if (!open) feedEvents.ctaCadastrar(posicao, pagina); setOpen((v) => !v); }}>
        <span aria-hidden className="text-base leading-none">+</span> Cadastrar ocorrência
      </button>
      {/* Os links ficam no HTML mesmo com o menu fechado (rastreáveis); fechado, só ficam escondidos */}
      <div id={menuId} hidden={!open} role="group" aria-label="Cadastrar ocorrência"
        className={`${open ? 'block' : 'hidden'} ${panel} rounded-xl border border-white/15 bg-[#10151c] p-1.5 shadow-xl shadow-black/50`}>
        <Link href={CTA_ROUTES.perdi} prefetch={false} className={item} onClick={() => feedEvents.ctaPerdi(posicao, pagina)}>Perdi algo</Link>
        <Link href={CTA_ROUTES.encontrei} prefetch={false} className={item} onClick={() => feedEvents.ctaEncontrei(posicao, pagina)}>Encontrei algo</Link>
        <Link href={CTA_ROUTES.roubado} prefetch={false} className={item} onClick={() => feedEvents.ctaRoubado(posicao, pagina)}>Roubaram algo meu</Link>
      </div>
    </div>
  );
}
