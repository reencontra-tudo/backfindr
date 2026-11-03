// URL base pública do Backfindr, sem barra final. Domínio canônico: https://backfindr.com (sem "www.").
// Use APP_URL em links gerados pelo servidor (e-mail, pagamento, login) e em canonical/og:url.
// NEXT_PUBLIC_APP_URL vazio ou ausente cai no domínio canônico.
export const DEFAULT_APP_URL = 'https://backfindr.com';

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, '');
