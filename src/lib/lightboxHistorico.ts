// Foto ampliada × histórico do navegador. Entra UMA entrada no histórico ao abrir (mesma URL, estado do Next.js preservado) para que o
// gesto/botão de voltar do aparelho feche só a foto. Funções puras sobre um «window» injetável, para testar sem navegador.

export const LIGHTBOX_CHAVE = 'bfLightbox';

interface JanelaHistorico {
  history: { state: unknown; pushState(data: unknown, unused: string, url?: string | URL | null): void; back(): void };
  addEventListener(tipo: 'popstate', f: () => void): void;
  removeEventListener(tipo: 'popstate', f: () => void): void;
}

const estadoDe = (w: JanelaHistorico): Record<string, unknown> | null => {
  const s = w.history.state; return s && typeof s === 'object' ? (s as Record<string, unknown>) : null;
};

/**
 * Abre a entrada de histórico da foto. Devolve a função que a encerra.
 * - pushState SEM url (a URL não muda: o Next não trata como navegação para outra rota) e com `{ ...history.state, bfLightbox: id }`,
 *   o que preserva `__NA` e a árvore do Next (o pushState remendado do Next repassa direto quando `__NA` existe).
 * - popstate (gesto/botão de voltar): fecha só a foto (`aoVoltar`); popstate que cai de novo na nossa própria entrada (avançar) é ignorado.
 * - encerrar por X, toque fora, ESC ou desmontagem: desfaz a entrada com back() SÓ se ela ainda for a atual (nunca deixa entrada órfã nem apaga a de outra tela).
 */
export function abrirEntradaLightbox(aoVoltar: () => void, w: JanelaHistorico | null = typeof window !== 'undefined' ? (window as unknown as JanelaHistorico) : null): () => void {
  if (!w) return () => {};
  const id = Math.random().toString(36).slice(2);
  let empilhou = false;
  let encerrado = false;
  try { w.history.pushState({ ...(estadoDe(w) ?? {}), [LIGHTBOX_CHAVE]: id }, ''); empilhou = true; } catch { /* sem histórico: X e toque fora continuam */ }
  const aoPopstate = () => {
    if (estadoDe(w)?.[LIGHTBOX_CHAVE] === id) return;
    encerrado = true; w.removeEventListener('popstate', aoPopstate); aoVoltar();
  };
  w.addEventListener('popstate', aoPopstate);
  return () => {
    w.removeEventListener('popstate', aoPopstate);
    if (empilhou && !encerrado) { encerrado = true; try { if (estadoDe(w)?.[LIGHTBOX_CHAVE] === id) w.history.back(); } catch { /* sem problema */ } }
  };
}

/** Faixa da borda esquerda onde o iOS começa o gesto de voltar do sistema (px). Toques que começam aí NÃO são passar de foto. */
export const BORDA_GESTO_PX = 28;
export const DISTANCIA_MINIMA_PX = 40;

/** Decide o que um deslize de dedo faz na foto ampliada. */
export function decidirDeslize(ini: { x: number; y: number }, fim: { x: number; y: number }, totalFotos: number): 'anterior' | 'proxima' | null {
  if (totalFotos < 2) return null;                         // com uma foto só, nada a passar (antes: deixava a foto invisível e o carregando para sempre)
  if (ini.x <= BORDA_GESTO_PX) return null;                // começou na borda esquerda: é o gesto de voltar do sistema
  const dx = fim.x - ini.x, dy = fim.y - ini.y;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > DISTANCIA_MINIMA_PX) return dx < 0 ? 'proxima' : 'anterior';
  return null;
}
