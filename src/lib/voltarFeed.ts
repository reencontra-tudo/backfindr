// «Voltar» da página da ocorrência: só volta no histórico quando a página anterior foi o Feed (que restaura filtro e rolagem);
// nos demais casos (abriu por link, pelo ícone, por notificação) leva ao Feed com um link comum. Só sessionStorage, em try/catch.
export const ORIGEM_FEED_CHAVE = 'bf-origem-feed-v1';

type Armazem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Clique num link de ocorrência feito DENTRO do Feed: guarda a marca. Qualquer outro clique não mexe. */
export function marcarOrigemFeed(armazem: Armazem | null, paginaAtual: string, destino: string | null): void {
  try {
    if (!armazem || !destino) return;
    if (!/^\/feed(\/|$)/.test(paginaAtual)) return;
    if (!/^\/objeto\/[^/?#]+/.test(destino)) return;
    armazem.setItem(ORIGEM_FEED_CHAVE, '1');
  } catch { /* sem armazenamento: o botão usa o link para o Feed */ }
}

/** true se a página anterior foi o Feed e há histórico para voltar. */
export function podeVoltarNoHistorico(armazem: Armazem | null, tamanhoHistorico: number): boolean {
  try { return !!armazem && armazem.getItem(ORIGEM_FEED_CHAVE) === '1' && tamanhoHistorico > 1; } catch { return false; }
}

export function limparOrigemFeed(armazem: Armazem | null): void {
  try { armazem?.removeItem(ORIGEM_FEED_CHAVE); } catch { /* sem problema */ }
}
