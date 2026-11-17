// Filtro do PostHog (gancho `before_send` do posthog-js, que vale para TODO evento: $pageview, $pageleave,
// autocapture, identify e gravação de sessão). Usa a lista central de src/lib/trackingGuard.ts; não tem
// regra própria.
//
// 1) Em página cuja URL traz credencial (link mágico, redefinição de senha, /custody/<token>,
//    /delivery/<token>, ou parâmetro token/access_token/...), NADA é enviado.
// 2) Nas demais páginas, todo valor que seja URL ou caminho e leve credencial (por exemplo
//    $session_entry_url, $referrer, $pathname, $prev_pageview_pathname) sai sem ela.
// Eventos de produto, o ID interno do usuário e o mascaramento de texto e de atributos não mudam.

import type { CaptureResult } from 'posthog-js';
import { isTrackingBlocked, redactTrackingUrl } from '@/lib/trackingGuard';

export interface PageLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

type Bag = Record<string, unknown>;
interface EventLike {
  event?: string;
  properties?: Bag;
  $set?: Bag;
  $set_once?: Bag;
  [k: string]: unknown;
}

// Teste barato antes de redigir: só mexe em texto que parece levar credencial.
const PARECE_CREDENCIAL = /(?:custody|delivery)\/|[?&#](?:token|access_token|refresh_token|id_token|otp|secret|password|senha)=/i;
const PARECE_URL = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/)/i;

function redigirTexto(v: string): string {
  if (!PARECE_CREDENCIAL.test(v)) return v;
  if (PARECE_URL.test(v)) return redactTrackingUrl(v);
  return v;
}

// Percorre objetos e listas (usado no conteúdo da gravação de sessão, que traz URLs de página e links do HTML).
function redigirProfundo(v: unknown, nivel = 0): unknown {
  if (typeof v === 'string') return redigirTexto(v);
  if (nivel > 40 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    let mudou = false;
    const out = v.map((x) => {
      const y = redigirProfundo(x, nivel + 1);
      if (y !== x) mudou = true;
      return y;
    });
    return mudou ? out : v;
  }
  const o = v as Bag;
  let copia: Bag | null = null;
  for (const k of Object.keys(o)) {
    const y = redigirProfundo(o[k], nivel + 1);
    if (y !== o[k]) {
      copia = copia ?? { ...o };
      copia[k] = y;
    }
  }
  return copia ?? v;
}

function redigirPropriedades(b: Bag | undefined, profundo: boolean): Bag | undefined {
  if (!b || typeof b !== 'object') return b;
  let copia: Bag | null = null;
  for (const k of Object.keys(b)) {
    const v = b[k];
    const y = typeof v === 'string' ? redigirTexto(v) : profundo ? redigirProfundo(v) : v;
    if (y !== v) {
      copia = copia ?? { ...b };
      copia[k] = y;
    }
  }
  return copia ?? b;
}

/** Devolve o evento a enviar, ou null para não enviar nada. Não altera o objeto recebido. */
export function sanitizePosthogEvent<T extends EventLike>(e: T | null, loc: PageLocation | null): T | null {
  if (!e) return null;
  if (loc && isTrackingBlocked(loc.pathname, loc.search, loc.hash)) return null;
  const snapshot = e.event === '$snapshot';
  const properties = redigirPropriedades(e.properties, snapshot);
  const $set = redigirPropriedades(e.$set, false);
  const $set_once = redigirPropriedades(e.$set_once, false);
  if (properties === e.properties && $set === e.$set && $set_once === e.$set_once) return e;
  const out: T = { ...e };
  if (properties !== undefined) out.properties = properties;
  if ($set !== undefined) out.$set = $set;
  if ($set_once !== undefined) out.$set_once = $set_once;
  return out;
}

/** Gancho para o posthog.init: lê a localização no momento do envio. */
export function posthogBeforeSend(cr: CaptureResult | null): CaptureResult | null {
  const loc =
    typeof window !== 'undefined'
      ? { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash }
      : null;
  return sanitizePosthogEvent(cr as unknown as EventLike | null, loc) as unknown as CaptureResult | null;
}
