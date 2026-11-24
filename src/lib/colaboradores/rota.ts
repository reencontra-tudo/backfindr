// Programa de Colaboradores — roteamento de `/@nome` (etapa E0). Funções puras, sem banco e sem imports do servidor:
// o middleware (edge) importa este arquivo.
//
// O App Router do Next trata pastas que começam com `@` como «slots» de rotas paralelas, não como pedaços de URL. Por isso a URL pública
// `/@nome` é reescrita no middleware para a rota interna `/colaborador/nome`.
//
// INTERRUPTOR: `COLABORADORES_ATIVO=1`. Ausente ou diferente de «1» = DESLIGADO (o padrão em produção). Desligado, o middleware não
// reescreve nada e `/@nome` responde 404 como sempre respondeu.

/** Formato do @nome: letras minúsculas, números e hífen; 3 a 30 caracteres; não começa nem termina com hífen. */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function colaboradoresAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.COLABORADORES_ATIVO === '1';
}

export function slugValido(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export type RotaColaborador =
  | { tipo: 'reescrever'; slug: string }   // `/@nome` (já em minúsculas) → `/colaborador/nome`
  | { tipo: 'minusculas'; slug: string }   // `/@Nome` → redireciona para `/@nome` (uma só URL canônica)
  | null;                                  // não é uma URL de colaborador: o middleware segue como sempre

/**
 * Decide o que fazer com um caminho. Só casa `/@nome` (com ou sem barra final). Qualquer outro caminho, inclusive `/@` sozinho,
 * `/@nome/outra-coisa` ou `@` no meio do caminho, devolve null (404 normal).
 */
export function rotaDeColaborador(pathname: string): RotaColaborador {
  const m = /^\/@([A-Za-z0-9-]{3,30})\/?$/.exec(pathname);
  if (!m) return null;
  const bruto = m[1];
  const slug = bruto.toLowerCase();
  if (!slugValido(slug)) return null;
  return bruto === slug ? { tipo: 'reescrever', slug } : { tipo: 'minusculas', slug };
}
