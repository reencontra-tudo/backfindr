// Regras de quando o Microsoft Clarity (gravação de sessão) pode carregar.
// Fonte única: o carregador (src/components/ClarityLoader.tsx), o mascaramento por segmento
// (src/components/ClarityMask.tsx) e o teste tests/clarity.test.ts usam estas listas.
//
// Reverter tudo: remover a variável NEXT_PUBLIC_CLARITY_PROJECT_ID do ambiente de produção e
// refazer o deploy (sem a variável nada é carregado).

/** Únicos hosts em que o Clarity pode carregar (produção real). Preview da Vercel, localhost e
 *  qualquer outro domínio ficam de fora. */
export const CLARITY_HOSTS = ['backfindr.com', 'www.backfindr.com'] as const;

/** Rotas (e tudo abaixo delas) em que o Clarity NUNCA carrega: áreas logadas/administrativas,
 *  páginas de autenticação (token de login/redefinição na URL), pagamento, páginas com token de
 *  custódia/entrega, portal B2B e a página de condomínio (login/cadastro dentro da página). */
export const CLARITY_EXCLUDED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/parceiro',
  '/portaria',
  '/auth',
  '/checkout',
  '/custody',
  '/delivery',
  '/b2b',
  '/condominio',
] as const;

/** Rotas públicas em que o Clarity pode carregar. Existe para o teste obrigar uma decisão sempre
 *  que surgir uma pasta nova em src/app: ou entra aqui, ou entra em CLARITY_EXCLUDED_PREFIXES. */
export const CLARITY_PUBLIC_PREFIXES = [
  '/achados-perdidos',
  '/achei',
  '/blog',
  '/buscar',
  '/colaborador',
  '/comecar',
  '/comunidade',
  '/encontrei',
  '/faq',
  '/feed',
  '/flow',
  '/map',
  '/objeto',
  '/perdi',
  '/pet',
  '/pricing',
  '/privacy',
  '/proteger',
  '/roubado',
  '/scan',
  '/terms',
  '/u',
] as const;

/** Pastas de src/app (relativas) públicas com dado de ocorrência, formulário ou conteúdo de usuário:
 *  o conteúdo é mascarado no Clarity (layout.tsx da pasta com <ClarityMask>). Em /flow o layout fica
 *  em cada fluxo, e não na raiz de /flow, porque testes existentes travam a listagem dessa pasta. */
export const CLARITY_MASKED_SEGMENTS = [
  'achei',
  'buscar',
  'colaborador',
  'comunidade',
  'feed',
  'flow/bike',
  'flow/found',
  'flow/keys',
  'flow/lost',
  'flow/pet',
  'flow/phone',
  'flow/protect',
  'flow/stolen',
  'flow/vehicle',
  'flow/wallet',
  'map',
  'objeto',
  'scan',
  'u',
] as const;

/** O projectId do Clarity é alfanumérico curto; qualquer outra coisa é ignorada (nada carrega). */
export function isValidClarityId(id: string | undefined | null): id is string {
  return typeof id === 'string' && /^[a-z0-9]{6,20}$/i.test(id.trim());
}

export function isClarityHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  return (CLARITY_HOSTS as readonly string[]).includes(hostname.trim().toLowerCase());
}

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

export function isClarityExcludedPath(pathname: string | null | undefined): boolean {
  if (pathname == null) return true; // sem rota conhecida: não grava
  const p = normalizePath(pathname);
  return CLARITY_EXCLUDED_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

export function shouldLoadClarity(opts: {
  projectId?: string | null;
  hostname?: string | null;
  pathname?: string | null;
  nodeEnv?: string | null;
}): boolean {
  return (
    isValidClarityId(opts.projectId) &&
    opts.nodeEnv === 'production' &&
    isClarityHost(opts.hostname) &&
    !isClarityExcludedPath(opts.pathname)
  );
}
