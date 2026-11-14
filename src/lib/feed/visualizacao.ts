// Feed: duas visualizações do MESMO conteúdo — «Publicações» (cards grandes, um abaixo do outro; padrão) e «Grade» (cards menores em colunas).
// A escolha fica no navegador (localStorage), em chave versionada; valor inválido é descartado; qualquer erro de armazenamento é ignorado.
// O servidor sempre desenha «Publicações»; a Grade só é aplicada no navegador, depois que a página carrega. Lógica pura (testável sem navegador).
export type Visualizacao = 'publicacoes' | 'grade';
export const VISUALIZACAO_PADRAO: Visualizacao = 'publicacoes';
export const CHAVE_VISUALIZACAO = 'feed-visualizacao-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const ehVisualizacao = (v: unknown): v is Visualizacao => v === 'publicacoes' || v === 'grade';

export function obterLocalStorage(): StorageLike | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** Preferência guardada, ou null (nada guardado, valor inválido — que é apagado —, ou armazenamento indisponível). Nunca lança. */
export function lerVisualizacao(storage: StorageLike | null): Visualizacao | null {
  if (!storage) return null;
  try {
    const v = storage.getItem(CHAVE_VISUALIZACAO);
    if (v === null) return null;
    if (ehVisualizacao(v)) return v;
    storage.removeItem(CHAVE_VISUALIZACAO);
    return null;
  } catch { return null; }
}

export function salvarVisualizacao(storage: StorageLike | null, v: Visualizacao): boolean {
  if (!storage || !ehVisualizacao(v)) return false;
  try { storage.setItem(CHAVE_VISUALIZACAO, v); return true; } catch { return false; }
}

/** Classes da lista de cards. Publicações: pilha com separadores (como hoje). Grade: 2 colunas até 559 px, 3 de 560 a 1023 px, 4 a partir de 1024 px. */
export function classesLista(v: Visualizacao, ocupado: boolean): string {
  const base = `mt-3 transition-opacity ${ocupado ? 'opacity-60' : ''}`;
  return v === 'grade'
    ? `${base} grid grid-flow-dense grid-cols-2 gap-3 min-[560px]:grid-cols-3 lg:grid-cols-4 lg:gap-4`
    : `${base} divide-y divide-[color:var(--f-linha)]`;
}

/** Largura da área de conteúdo: Publicações é uma coluna estreita; a Grade usa a largura toda disponível (até 72 rem). */
export function classesLargura(v: Visualizacao): string {
  return v === 'grade' ? 'mx-auto w-full max-w-6xl' : 'mx-auto w-full max-w-2xl';
}

/** O card sem foto da Grade usa um bloco com a MESMA proporção da foto (4:3), para a altura ser a mesma dos cards com foto. */
export const PROPORCAO_FOTO_GRADE = 'aspect-[4/3]';
