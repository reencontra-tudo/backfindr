'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { shouldLoadClarity, isClarityExcludedPath, isClarityHost } from '@/lib/clarity';

// Carrega o Microsoft Clarity (gravação de sessão + mapa de calor) só quando as regras de
// src/lib/clarity.ts permitem: variável definida, produção, host oficial e rota pública.
// Um único ponto de decisão, no layout raiz. Sem NEXT_PUBLIC_CLARITY_PROJECT_ID nada é carregado.

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

// Estado do documento atual (zera em recarga completa da página).
let injected = false;
let stopped = false;

function injectClarity(id: string) {
  if (injected || stopped) return;
  injected = true;
  // Mesmo trecho oficial que já rodava antes (layout.tsx), com o id vindo da variável.
  (function (c: Window & Record<string, any>, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function (...args: unknown[]) { (c[a].q = c[a].q || []).push(args); };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window as Window & Record<string, any>, document, 'clarity', 'script', id);
}

// Navegação do app (sem recarregar): se o visitante saiu de uma página pública para uma área
// excluída com o Clarity já ativo, encerra a gravação. 'stop' existe no clarity.js publicado,
// mas não está na página de documentação da API: por isso fica dentro de try/catch.
function stopClarity() {
  // Só há o que parar se o Clarity já foi carregado neste documento. Quem começa numa área
  // excluída (ex.: login) e depois vai a uma página pública continua podendo ser gravado nela.
  if (!injected) return;
  stopped = true;
  try {
    if (typeof window.clarity === 'function') window.clarity('stop');
  } catch {
    /* sem efeito colateral: o pior caso é a gravação seguir até a próxima carga de página */
  }
}

export default function ClarityLoader({ projectId }: { projectId?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!projectId) return;
    if (!isClarityHost(window.location.hostname)) return;

    if (isClarityExcludedPath(pathname)) {
      stopClarity();
      return;
    }
    if (injected || stopped) return;

    const id = projectId.trim();
    const run = () => {
      // Reavalia na hora de carregar: a rota pode ter mudado enquanto esperava.
      if (
        shouldLoadClarity({
          projectId: id,
          hostname: window.location.hostname,
          pathname: window.location.pathname,
          nodeEnv: process.env.NODE_ENV,
        })
      ) {
        injectClarity(id);
      }
    };

    // Carregamento tardio (equivale ao lazyOnload de antes): depois do evento load, em ociosidade.
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 });
      else window.setTimeout(run, 1500);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
    };
  }, [pathname, projectId]);

  return null;
}
