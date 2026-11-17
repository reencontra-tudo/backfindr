// Dispara um evento de conversão do Pixel (fbq) ou do GA4 (gtag) assim que o tracker existir.
//
// Por que existe: os scripts carregam depois da hidratação (Pixel) ou depois do evento `load` e da
// ociosidade (GA4), e um efeito de página roda antes disso. Na ENTRADA DIRETA na página (anúncio, link,
// recarga) o `window.fbq` ainda não existe e o evento se perdia; na navegação interna ele já existe.
// `fbq` e `gtag` são definidos de forma síncrona pelo trecho inline de cada script (as chamadas ficam
// numa fila até o script completo chegar), então basta esperar essa definição.
//
// Garantias: dispara no máximo UMA vez por chamada; quem chama recebe uma função de cancelamento (use no
// retorno do useEffect); nunca dispara em rota bloqueada pelo trackingGuard (src/lib/trackingGuard.ts);
// desiste depois de `limiteMs` (se o tracker nunca carregar, nada acontece).

import { isTrackingBlocked } from '@/lib/trackingGuard';

export type NomeTracker = 'fbq' | 'gtag';

export interface OpcoesTrackerReady {
  intervaloMs?: number;
  limiteMs?: number;
}

export function quandoTrackerPronto(nome: NomeTracker, disparar: () => void, opcoes: OpcoesTrackerReady = {}): () => void {
  if (typeof window === 'undefined') return () => {};
  const intervalo = opcoes.intervaloMs ?? 100;
  const limite = opcoes.limiteMs ?? 15000;
  let terminou = false;
  let cancelado = false;

  // true = acabou (disparou, bloqueou ou foi cancelado); false = ainda esperando o tracker.
  const tentar = (): boolean => {
    if (terminou || cancelado) return true;
    if (isTrackingBlocked(window.location.pathname, window.location.search, window.location.hash)) {
      terminou = true;
      return true;
    }
    if (typeof (window as unknown as Record<string, unknown>)[nome] !== 'function') return false;
    terminou = true;
    try {
      disparar();
    } catch {
      /* analítica nunca pode quebrar a página */
    }
    return true;
  };

  if (tentar()) return () => { cancelado = true; };

  const inicio = Date.now();
  const id = setInterval(() => {
    if (tentar() || Date.now() - inicio >= limite) clearInterval(id);
  }, intervalo);
  return () => {
    cancelado = true;
    clearInterval(id);
  };
}
