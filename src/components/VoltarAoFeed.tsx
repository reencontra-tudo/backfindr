'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { limparOrigemFeed, podeVoltarNoHistorico } from '@/lib/voltarFeed';

const armazem = () => { try { return window.sessionStorage; } catch { return null; } };

/**
 * Botão «Voltar» sempre visível (o app instalado no iPhone não tem o botão do navegador).
 * Veio do Feed: volta no histórico (o Feed restaura filtro e rolagem). Senão: link comum para /feed.
 * É um <a href="/feed"> de verdade, então funciona mesmo antes de o JavaScript carregar.
 */
export function VoltarAoFeed() {
  return (
    <Link
      href="/feed"
      data-voltar-feed
      aria-label="Voltar ao Feed"
      onClick={(e) => {
        const a = armazem();
        if (podeVoltarNoHistorico(a, window.history.length)) { e.preventDefault(); limparOrigemFeed(a); window.history.back(); }
      }}
      className="-ml-2 mr-1 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-sm font-semibold text-white/80 hover:text-white"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      <span>Voltar</span>
    </Link>
  );
}
