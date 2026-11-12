// Ordem do Feed — por FAIXAS (não por soma de pontos). Função pura, sem banco.
//   1) boost ativo (hoje não há nenhum);
//   2) faixa de região do visitante (0 = mesma cidade, 1 = mesma região/estado); sem localização, uma faixa só;
//   3) usuário atual antes de sinal público;
//   4) com foto antes de sem foto;
//   5) created_at mais recente; código como desempate final (ordem estável e reproduzível).
// Teto de sinais públicos: como usuário vem sempre antes de sinal dentro da faixa, os sinais só aparecem no
// topo depois que os cadastros de usuários daquela faixa acabam (0 sinais por 3 cards enquanto houver usuário,
// sempre ≤ 1 a cada 3). Não há preenchimento com outras regiões.
export interface Rankable {
  code: string;
  origin: 'usuario' | 'sinal_publico';
  hasPhoto: boolean;
  createdAtMs: number;
  boosted: boolean;
  band: number;
}

export function compareFeed(a: Rankable, b: Rankable): number {
  if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
  if (a.band !== b.band) return a.band - b.band;
  if (a.origin !== b.origin) return a.origin === 'usuario' ? -1 : 1;
  if (a.hasPhoto !== b.hasPhoto) return a.hasPhoto ? -1 : 1;
  if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

export const rankFeed = <T extends Rankable>(items: T[]): T[] => [...items].sort(compareFeed);

/**
 * Verifica o teto: em cada faixa, enquanto ainda restam usuários adiante (até o último usuário da faixa),
 * nenhuma janela de 3 cards tem mais de 1 sinal público. Depois que os usuários da faixa acabam, só sobram
 * sinais e não há o que intercalar (isso não é «preencher»: nenhum item de outra região entra).
 */
export function signalCapHolds(ranked: Rankable[]): boolean {
  const bands = new Set(ranked.map((x) => x.band));
  for (const band of bands) {
    const inBand = ranked.filter((x) => x.band === band && !x.boosted);
    let lastUser = -1;
    inBand.forEach((x, i) => { if (x.origin === 'usuario') lastUser = i; });
    for (let i = 0; i + 2 <= lastUser; i++) {
      if (inBand.slice(i, i + 3).filter((x) => x.origin === 'sinal_publico').length > 1) return false;
    }
  }
  return true;
}
