// Quando o Meta Pixel e o GA4 NÃO podem carregar: páginas cuja URL carrega algo que funciona como
// credencial (token de link mágico, token de redefinição de senha, token de link de custódia ou de
// entrega). Os dois scripts leem a URL completa (query incluída) e a enviam a Meta e Google; por isso,
// nessas páginas eles simplesmente não são carregados (src/components/TrackingScripts.tsx).
//
// Não depende de nenhum dado: só da URL. Fonte única da lista; o teste tests/rastreio-token-url.test.ts
// exige que toda rota nova com token na URL seja classificada aqui.

/** Rotas cujo CAMINHO carrega o token (o segundo trecho do caminho é o segredo). */
const TOKEN_IN_PATH: readonly RegExp[] = [
  /^\/custody\/[^/]+/, // /custody/<token>: link pessoal, sem validade
  // /delivery/<token>: link pessoal, sem validade. /delivery/entregador/* são telas do entregador (sem token).
  /^\/delivery\/(?!entregador(?:\/|$))[^/]+/,
];

/** Caminhos (já normalizados: minúsculos, sem barra final) em que os trackers não carregam. */
export const TRACKING_BLOCKED_PATHS: readonly RegExp[] = [
  /^\/auth\/magic-confirm$/, // ?token= (uso único, 15 min), consumido só no clique do botão
  /^\/auth\/reset-password$/, // ?token= (1 h), consumido ao trocar a senha
  ...TOKEN_IN_PATH,
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

// ── Redação de URLs (usada pelo PostHog, que recebe a URL em vários campos de cada evento) ──────────────

function cleanParams(raw: string, prefix: '?' | '#'): string {
  if (!raw) return '';
  const body = raw.slice(1);
  if (!body.includes('=')) return raw; // âncora comum (#secao): fica
  const kept = body.split('&').filter((pair) => {
    const nome = pair.split('=')[0] ?? '';
    let k = nome;
    try {
      k = decodeURIComponent(nome);
    } catch {
      /* usa o texto como veio */
    }
    return !SENSITIVE_QUERY_PARAMS.includes(k.trim().toLowerCase());
  });
  return kept.length ? prefix + kept.join('&') : '';
}

/**
 * Devolve a URL (absoluta ou só o caminho) sem credenciais: tira da query e do hash os parâmetros de
 * SENSITIVE_QUERY_PARAMS e troca o token do caminho de /custody e /delivery por [token]. O resto fica igual.
 */
export function redactTrackingUrl(raw: string): string {
  if (typeof raw !== 'string' || raw === '') return raw;
  const m = raw.match(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!m) return raw;
  const origin = m[1] ?? '';
  let path = m[2] ?? '';
  if (TOKEN_IN_PATH.some((re) => re.test(normalizePath(path)))) {
    const partes = path.split('/'); // ['', 'custody', '<token>', ...]
    if (partes.length > 2) {
      partes[2] = '[token]';
      path = partes.join('/');
    }
  }
  return origin + path + cleanParams(m[3] ?? '', '?') + cleanParams(m[4] ?? '', '#');
}
