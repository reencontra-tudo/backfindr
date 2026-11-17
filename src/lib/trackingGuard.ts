// Quando o Meta Pixel e o GA4 NÃO podem carregar: páginas cuja URL carrega algo que funciona como
// credencial (token de link mágico, token de redefinição de senha, token de link de custódia ou de
// entrega). Os dois scripts leem a URL completa (query incluída) e a enviam a Meta e Google; por isso,
// nessas páginas eles simplesmente não são carregados (src/components/TrackingScripts.tsx).
//
// Não depende de nenhum dado: só da URL. Fonte única da lista; o teste tests/rastreio-token-url.test.ts
// exige que toda rota nova com token na URL seja classificada aqui.

/** Caminhos (já normalizados: minúsculos, sem barra final) em que os trackers não carregam. */
export const TRACKING_BLOCKED_PATHS: readonly RegExp[] = [
  /^\/auth\/magic-confirm$/, // ?token= (uso único, 15 min), consumido só no clique do botão
  /^\/auth\/reset-password$/, // ?token= (1 h), consumido ao trocar a senha
  /^\/custody\/[^/]+/, // /custody/<token>: link pessoal, sem validade
  // /delivery/<token>: link pessoal, sem validade. /delivery/entregador/* são telas do entregador (sem token).
  /^\/delivery\/(?!entregador(?:\/|$))[^/]+/,
];

/** Parâmetros que, em qualquer rota, indicam credencial na URL (rede de segurança para links novos ou antigos). */
export const SENSITIVE_QUERY_PARAMS: readonly string[] = [
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'otp',
  'secret',
  'password',
  'senha',
];

function normalizePath(pathname: string): string {
  let p = pathname || '/';
  try {
    p = decodeURIComponent(p);
  } catch {
    /* caminho malformado: usa o texto como veio */
  }
  p = p.toLowerCase().replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.startsWith('/') ? p : `/${p}`;
}

function hasSensitiveParam(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const s = raw.replace(/^[?#]/, '');
  if (!s) return false;
  try {
    for (const k of new URLSearchParams(s).keys()) {
      if (SENSITIVE_QUERY_PARAMS.includes(k.trim().toLowerCase())) return true;
    }
  } catch {
    /* texto que não é query: ignora */
  }
  return false;
}

export function isTrackingBlocked(
  pathname: string | null | undefined,
  search?: string | null,
  hash?: string | null,
): boolean {
  if (pathname == null) return true; // sem rota conhecida: não carrega
  const p = normalizePath(pathname);
  if (TRACKING_BLOCKED_PATHS.some((re) => re.test(p))) return true;
  return hasSensitiveParam(search) || hasSensitiveParam(hash);
}

// ─── Limpeza de URL para o PostHog ───────────────────────────────────────────
// O PostHog não deixa de carregar (decisão à parte, F-35): em vez disso, toda URL que ele envia passa
// por aqui. Mesma lista (SENSITIVE_QUERY_PARAMS / TRACKING_BLOCKED_PATHS) do Pixel e do GA4.

export const REDACTED = '[redacted]';

/** Propriedades de evento do PostHog que carregam URL ou caminho. */
export const POSTHOG_URL_PROPS: readonly string[] = [
  '$current_url',
  '$referrer',
  '$pathname',
  '$initial_current_url',
  '$initial_referrer',
  '$initial_pathname',
  '$session_entry_url',
  '$session_entry_referrer',
  '$session_entry_pathname',
  'href',
];

function stripSensitive(params: string, prefix: '?' | '#'): string {
  const kept: string[] = [];
  for (const part of params.split('&')) {
    if (!part) continue;
    let key = part.split('=')[0];
    try {
      key = decodeURIComponent(key.replace(/\+/g, ' '));
    } catch {
      /* chave malformada: usa o texto como veio */
    }
    if (!SENSITIVE_QUERY_PARAMS.includes(key.trim().toLowerCase())) kept.push(part);
  }
  return kept.length ? prefix + kept.join('&') : '';
}

/**
 * Devolve a URL (absoluta ou só caminho) sem credenciais:
 *  - rota bloqueada (link mágico, redefinição, /custody/<token>, /delivery/<token>): sem query e sem
 *    fragmento, e o segmento do token no caminho vira `[redacted]`;
 *  - qualquer outra rota: só os parâmetros sensíveis saem da query e do fragmento; o resto fica igual.
 * Valor que não é texto, ou que não dá para interpretar como URL, volta como veio quando não há
 * nada sensível; se houver, a query e o fragmento são descartados por inteiro.
 */
export function sanitizeTrackedUrl<T>(value: T): T {
  if (typeof value !== 'string' || !value) return value;
  const m = /^((?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(value);
  if (!m) return value;
  const [, origin = '', path = '', query = '', hash = ''] = m;
  if (path && TRACKING_BLOCKED_PATHS.some((re) => re.test(normalizePath(path)))) {
    const segs = path.split('/');
    // /custody/<token> e /delivery/<token>: o token é o 3º elemento ('', 'custody', '<token>').
    const tokenInPath = /^\/(custody|delivery)\//i.test(path);
    if (tokenInPath && segs.length > 2) segs[2] = REDACTED;
    return (origin + segs.join('/')) as unknown as T;
  }
  const q = query ? stripSensitive(query.slice(1), '?') : '';
  const h = hash ? stripSensitive(hash.slice(1), '#') : '';
  return (origin + path + q + h) as unknown as T;
}

function sanitizeReplayEvent(ev: unknown): unknown {
  if (typeof ev === 'string') {
    try {
      const parsed = JSON.parse(ev);
      const clean = sanitizeReplayEvent(parsed);
      return clean === parsed ? ev : JSON.stringify(clean);
    } catch {
      return ev;
    }
  }
  if (!ev || typeof ev !== 'object') return ev;
  const e = ev as { data?: { href?: unknown; payload?: { href?: unknown } } };
  const d = e.data;
  if (!d || typeof d !== 'object') return ev;
  const href = typeof d.href === 'string' ? sanitizeTrackedUrl(d.href) : d.href;
  const p = d.payload;
  const phref = p && typeof p === 'object' && typeof p.href === 'string' ? sanitizeTrackedUrl(p.href) : p?.href;
  if (href === d.href && phref === p?.href) return ev;
  return { ...e, data: { ...d, ...(href !== d.href ? { href } : {}), ...(p && phref !== p.href ? { payload: { ...p, href: phref } } : {}) } };
}

/** Eventos da gravação de sessão (rrweb): a URL da página vai em `data.href` (Meta) e `data.payload.href` (custom). */
export function sanitizeSnapshotData(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(sanitizeReplayEvent);
  return sanitizeReplayEvent(data);
}

/** Limpa as propriedades de URL de um objeto de propriedades do PostHog (sem alterar as demais). */
export function sanitizePostHogProps<P extends Record<string, unknown> | undefined | null>(props: P): P {
  if (!props || typeof props !== 'object') return props;
  const out: Record<string, unknown> = { ...props };
  for (const k of POSTHOG_URL_PROPS) {
    if (k in out) out[k] = sanitizeTrackedUrl(out[k]);
  }
  if ('$snapshot_data' in out) out.$snapshot_data = sanitizeSnapshotData(out.$snapshot_data);
  return out as P;
}
