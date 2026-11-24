// Programa de Colaboradores (E1): lado do navegador. Sem rastreamento: o código viaja na URL da jornada (`?colab=`) e fica em `sessionStorage`
// (só desta aba, some ao fechar a aba) até o envio da ocorrência. NENHUM cookie novo, nenhum uso do cookie de origem, nada vai para o PostHog por aqui.

/**
 * Interruptor do lado do navegador: `NEXT_PUBLIC_COLABORADORES_ATIVO=1` (valor fixado na hora do build; ausente = desligado, e todo o código do programa
 * no navegador fica inativo). Liga-se JUNTO com `COLABORADORES_ATIVO=1` do servidor; se só um estiver ligado, nada quebra (o servidor ignora ou recusa).
 */
export const colaboradoresAtivoNoCliente = (): boolean => process.env.NEXT_PUBLIC_COLABORADORES_ATIVO === '1';

export const PARAM_CODIGO = 'colab';
export const CHAVE_SESSAO = 'bf_colab';
/** Formato aceito para o código que chega pela URL ou vem digitado: `@nome` ou código curto (letras sem acento, números, hífen), 2 a 31 caracteres com o `@`. */
const FORMATO = /^@?[A-Za-z0-9-]{2,30}$/;

export function codigoValido(texto: unknown): texto is string {
  return typeof texto === 'string' && FORMATO.test(texto.trim());
}

/** Lê `?colab=` de uma query (`window.location.search` ou `URLSearchParams`). Valor ausente ou malformado = null. */
export function codigoDaUrl(search: string | URLSearchParams): string | null {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const v = p.get(PARAM_CODIGO);
  return codigoValido(v) ? v.trim() : null;
}

type Armazem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const sessao = (): Armazem | null => { try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; } };

export function guardarCodigo(codigo: string, armazem: Armazem | null = sessao()): void {
  if (!armazem || !codigoValido(codigo)) return;
  try { armazem.setItem(CHAVE_SESSAO, codigo.trim()); } catch { /* sem armazenamento: segue sem guardar */ }
}
export function codigoGuardado(armazem: Armazem | null = sessao()): string | null {
  if (!armazem) return null;
  try { const v = armazem.getItem(CHAVE_SESSAO); return codigoValido(v) ? v.trim() : null; } catch { return null; }
}
export function limparCodigoGuardado(armazem: Armazem | null = sessao()): void {
  if (!armazem) return;
  try { armazem.removeItem(CHAVE_SESSAO); } catch { /* ignora */ }
}

/** Código inicial do formulário: o da URL (se houver) tem prioridade sobre o guardado na aba. Desligado: sempre null. */
export function codigoInicial(search: string | URLSearchParams, armazem: Armazem | null = sessao(), ativo: boolean = colaboradoresAtivoNoCliente()): string | null {
  if (!ativo) return null;
  return codigoDaUrl(search) ?? codigoGuardado(armazem);
}
