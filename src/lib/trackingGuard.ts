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
