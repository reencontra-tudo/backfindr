// FONTE ÚNICA dos limites de objetos por plano (PL-01, decisão do fundador, 24/11/2026).
// O limite de 3 objetos do plano free foi PAUSADO: free agora tem um teto anti-abuso (100 objetos ativos e 10 cadastros em 24 h).
// Pro e Business ficam com os números de antes (50 e 500). Para REATIVAR o limite antigo, troque `maxObjetos` do free para 3 (e tire o `maxPorDia`);
// os textos que mostram o teto leem estas constantes.
export type PlanoSlug = 'free' | 'pro' | 'business';

export interface LimitesDoPlano {
  /** Máximo de objetos ATIVOS (não conta arquivados, devolvidos, apagados nem legados). */
  maxObjetos: number;
  /** Máximo de cadastros em 24 horas (null = sem limite diário). */
  maxPorDia: number | null;
}

export const LIMITES_DOS_PLANOS: Readonly<Record<PlanoSlug, LimitesDoPlano>> = {
  free:     { maxObjetos: 100, maxPorDia: 10 },
  pro:      { maxObjetos: 50,  maxPorDia: null },
  business: { maxObjetos: 500, maxPorDia: null },
};

export function limitesDoPlano(plano: string | null | undefined): LimitesDoPlano {
  return LIMITES_DOS_PLANOS[(plano as PlanoSlug) in LIMITES_DOS_PLANOS ? (plano as PlanoSlug) : 'free'];
}

/** Status que NÃO ocupam vaga no limite (resolvidos/apagados). */
export const STATUS_QUE_NAO_CONTAM = ['deleted', 'archived', 'returned'] as const;

export function mensagemDeLimite(tipo: 'total' | 'diario', plano: string, lim: LimitesDoPlano): string {
  if (tipo === 'diario') {
    return `Você já cadastrou ${lim.maxPorDia} ocorrências nas últimas 24 horas (limite diário do plano ${plano}). Tente de novo mais tarde.`;
  }
  return `Você atingiu o limite de ${lim.maxObjetos} objetos ativos do plano ${plano}. Arquive ou marque como devolvidos os que já foram resolvidos, ou conheça os planos em /pricing.`;
}
