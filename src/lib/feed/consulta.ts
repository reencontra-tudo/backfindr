// Busca do Feed — parte que roda no NAVEGADOR e no servidor (sem banco). O texto digitado NUNCA vai para a URL da página nem para analítica.
export const BUSCA_MIN_CARACTERES = 2;
export const BUSCA_MAX_CARACTERES = 80;
export const BUSCA_EVENTO = 'bf-feed-abrir-busca';

/** Texto da busca: sem espaços sobrando, sem caracteres de controle e com no máximo 80 caracteres. */
export function normalizarConsulta(bruto: unknown): string {
  if (typeof bruto !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return bruto.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, BUSCA_MAX_CARACTERES).trim();
}

/** ?q= de quem chegou pelo /buscar antigo (ou por um link): lido uma vez, depois de montar. */
export function consultaDaUrl(search: string): string {
  try { return normalizarConsulta(new URLSearchParams(search).get('q')); } catch { return ''; }
}

/** Pede ao Feed que abra (e foque) o campo de busca. Sem Feed montado, não faz nada. */
export function abrirBuscaDoFeed(): void {
  try { window.dispatchEvent(new CustomEvent(BUSCA_EVENTO)); } catch { /* sem problema */ }
}
