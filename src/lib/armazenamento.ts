/**
 * Pede ao navegador que não apague o armazenamento do site (localStorage etc.) por falta de espaço ou inatividade.
 * Inofensivo e sem pergunta ao usuário; não faz nada onde não existe. Nunca lança erro.
 */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persist !== 'function') return false;
    return (await navigator.storage.persist()) === true;
  } catch { return false; }
}
