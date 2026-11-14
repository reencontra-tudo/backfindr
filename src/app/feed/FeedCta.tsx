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

/** Dois botões compactos do topo («Perdi» / «Encontrei»): mesmos destinos e eventos; o nome acessível continua «Perdi algo» / «Encontrei algo». */
export function TopoBotoes({ pagina }: { pagina: number }) {
  const base = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-0';
  return (
    <div className="mt-2 flex gap-2" data-feed-topo-cta>
      <Link href={CTA_ROUTES.perdi} prefetch={false} aria-label="Perdi algo" onClick={() => feedEvents.ctaPerdi('topo', pagina)}
        className={`${base} bg-amber-300 text-[#1a1203] hover:bg-amber-200 focus:ring-amber-100`}>Perdi</Link>
      <Link href={CTA_ROUTES.encontrei} prefetch={false} aria-label="Encontrei algo" onClick={() => feedEvents.ctaEncontrei('topo', pagina)}
        className={`${base} bg-teal-500 text-[#04110f] hover:bg-teal-400 focus:ring-teal-200`}>Encontrei</Link>
    </div>
  );
}

/** Dois botões lado a lado (usados no convite do fim da lista). */
export function IntroButtons({ pagina, posicao = 'topo', compacto = false }: { pagina: number; posicao?: FeedCtaPosicao; compacto?: boolean }) {
  // compacto (convite do fim): largura natural, à esquerda (nunca chega à área do botão de chat) e empilhados abaixo de 360 px
  return (
    <div className={compacto ? 'mt-3 flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:flex-wrap' : 'mt-3 grid grid-cols-2 gap-2'}>
      <Link href={CTA_ROUTES.perdi} prefetch={false} onClick={() => feedEvents.ctaPerdi(posicao, pagina)}
        className={`${linkBase} bg-amber-300 text-[#1a1203] hover:bg-amber-200 focus:ring-amber-100`}>Perdi algo</Link>
      <Link href={CTA_ROUTES.encontrei} prefetch={false} onClick={() => feedEvents.ctaEncontrei(posicao, pagina)}
        className={`${linkBase} bg-teal-500 text-[#04110f] hover:bg-teal-400 focus:ring-teal-200`}>Encontrei algo</Link>
    </div>
  );
}

/** Convite do fim da lista (depois do 3º lote automático, abaixo do «Ver mais», e quando não há mais cards). Mesmos botões, rotas e eventos do topo. */
export function ConviteFim({ pagina }: { pagina: number }) {
  return (
    <aside aria-label="Convite para cadastrar" className="mt-8 rounded-xl bg-[color:var(--f-aviso)] p-4" data-feed-convite>
      <h2 className="text-base font-semibold text-[color:var(--f-t1)]">Não encontrou o que procurava?</h2>
      <IntroButtons pagina={pagina} posicao="fim" compacto />
    </aside>
  );
}

/**
 * O botão fixo cobriria texto ou botão neste ponto da rolagem? Mede a faixa onde ele fica (canto inferior esquerdo, com a
 * margem da área segura) contra os textos (retângulos só do texto, não da linha inteira) e os botões/links/campos da página.
 * Fotos não contam: cobrir uma foto não esconde informação.
 */
function cobreConteudo(box: HTMLElement): boolean {
  const btn = box.querySelector('button');
  if (!btn) return false;
  const cs = getComputedStyle(box);
  const bottom = parseFloat(cs.bottom) || 16, left = parseFloat(cs.left) || 16, folga = 4;
  const l = left - folga, r = left + btn.offsetWidth + folga;
  const b = window.innerHeight - bottom + folga, t = b - btn.offsetHeight - 2 * folga;
  const cruza = (q: { left: number; right: number; top: number; bottom: number }) => !(q.right <= l || r <= q.left || q.bottom <= t || b <= q.top);
  for (const e of document.querySelectorAll('main h1, main h2, main h3, main p, main time, main label, main a, main button, main select')) {
    if (box.contains(e)) continue;
    const bx = e.getBoundingClientRect();
    if (!bx.width || bx.bottom < t || bx.top > b) continue;           // fora da faixa do botão
    if (e.matches('a, button, select')) { if (cruza(bx)) return true; continue; }
    const rg = document.createRange(); rg.selectNodeContents(e);
    for (const q of Array.from(rg.getClientRects())) if (q.width > 2 && q.height > 2 && cruza(q)) return true;
  }
  return false;
}

/** Menu «+ Cadastrar ocorrência». variant «fixed» = só celular; «header» = só desktop (sm para cima). */
export function RegisterMenu({ variant, pagina }: { variant: 'fixed' | 'header'; pagina: number }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const posicao: FeedCtaPosicao = variant === 'fixed' ? 'fixo' : 'cabecalho';
  // Só o botão FIXO (celular). Regras: some ao rolar para baixo e volta ao rolar para cima (ou ao chegar ao topo ou receber foco);
  // com o menu aberto nunca some; e, quando a rolagem para, ele só fica visível se NÃO cobrir texto nem botão da página
  // (enquanto a página se mexe ele fica recolhido). No HTML do servidor ele já vem visível (igual para todos).
  const [recolhido, setRecolhido] = useState(false);   // rolou para baixo
  const [rolando, setRolando] = useState(false);       // a página está se mexendo agora
  const [sobreposto, setSobreposto] = useState(false); // neste ponto ele cobriria texto/botão
  const [comFoco, setComFoco] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;
  useEffect(() => {
    if (variant !== 'fixed') return;
    let ultimo = window.scrollY, ticking = false, parou: ReturnType<typeof setTimeout> | null = null;
    const medir = () => { if (box.current) setSobreposto(cobreConteudo(box.current)); };
    const aoParar = () => { setRolando(false); medir(); };
    // A página também muda sem rolagem (fotos que terminam de carregar empurram o conteúdo): remede quando o tamanho muda.
    let remedir: ReturnType<typeof setTimeout> | null = null;
    const agendarMedir = () => { if (remedir) clearTimeout(remedir); remedir = setTimeout(medir, 120); };
    const principal = document.querySelector('main');
    const ro = principal && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(agendarMedir) : null;
    if (principal && ro) ro.observe(principal);
    document.addEventListener('load', agendarMedir, true);
    const onScroll = () => {
      setRolando(true);
      if (parou) clearTimeout(parou);
      parou = setTimeout(aoParar, 140);
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.max(0, window.scrollY), d = y - ultimo;
        const fim = y >= document.documentElement.scrollHeight - window.innerHeight - 8;   // chegou ao fim (espaço reservado, livre)
        if (y <= 24 || fim) setRecolhido(false);                            // topo e fim da página
        else if (d > 8 && !openRef.current) { setRecolhido(true); }         // rolando para baixo
        else if (d < -8) setRecolhido(false);                               // rolando para cima
        if (Math.abs(d) > 8 || y <= 24) ultimo = y;
      });
    };
    const el = box.current;
    const onFocusIn = () => { setComFoco(true); setRecolhido(false); };
    const onFocusOut = () => setComFoco(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', medir); window.addEventListener('orientationchange', medir); window.addEventListener('load', medir);
    el?.addEventListener('focusin', onFocusIn); el?.addEventListener('focusout', onFocusOut);
    const inicial = setTimeout(medir, 300);   // depois do primeiro desenho
    const reforco = setTimeout(medir, 1500);  // depois de fotos e fontes
    return () => {
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir); window.removeEventListener('load', medir);
      el?.removeEventListener('focusin', onFocusIn); el?.removeEventListener('focusout', onFocusOut);
      if (parou) clearTimeout(parou); if (remedir) clearTimeout(remedir); clearTimeout(inicial); clearTimeout(reforco);
      ro?.disconnect(); document.removeEventListener('load', agendarMedir, true);
    };
  }, [variant]);
  const escondido = variant === 'fixed' && !open && !comFoco && (recolhido || rolando || sobreposto);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const wrap = variant === 'fixed'
    ? 'fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-4 z-40 sm:hidden'   // canto inferior ESQUERDO: o chat fica no direito
    : 'relative hidden sm:block';
  const trigger = variant === 'fixed'
    ? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-teal-400/70 bg-[#10151c]/95 px-4 text-sm font-semibold text-teal-100 shadow-lg shadow-black/40 backdrop-blur hover:bg-[#16202a] focus:outline-none focus:ring-2 focus:ring-teal-300'
    : 'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-[#04110f] hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200';
  const panel = variant === 'fixed'
    ? 'absolute bottom-full left-0 mb-2 w-60'
    : 'absolute right-0 top-full z-40 mt-2 w-60';
  const item = 'flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-300';

  return (
    <div ref={box} data-feed-register={variant} data-recolhido={variant === 'fixed' ? String(escondido) : undefined} data-sobreposto={variant === 'fixed' ? String(sobreposto) : undefined}
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
