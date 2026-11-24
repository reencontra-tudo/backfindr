// FONTE ÚNICA dos limites de objetos por plano (PL-01, decisão do fundador, 24/11/2026). Depende do «modo crescimento» (`modoCrescimento.ts`).
//   MODO CRESCIMENTO LIGADO : free = teto anti-abuso (100 objetos ativos e 10 cadastros em 24 h); Pro 50 e Business 500 (contas pagas existentes intactas).
//   MODO CRESCIMENTO DESLIGADO: exatamente como antes do PL-01: free 3 (sem limite diário), Pro 50, Business 500.
// A CONTAGEM (ignora arquivados, devolvidos, apagados e legados) vale nos dois estados.
import { modoCrescimento } from '@/lib/modoCrescimento';

export type PlanoSlug = 'free' | 'pro' | 'business';

export interface LimitesDoPlano {
  /** Máximo de objetos ATIVOS (não conta arquivados, devolvidos, apagados nem legados). */
  maxObjetos: number;
  /** Máximo de cadastros em 24 horas (null = sem limite diário). */
  maxPorDia: number | null;
}

export const LIMITES_CRESCIMENTO: Readonly<Record<PlanoSlug, LimitesDoPlano>> = {
  free:     { maxObjetos: 100, maxPorDia: 10 },
  pro:      { maxObjetos: 50,  maxPorDia: null },
  business: { maxObjetos: 500, maxPorDia: null },
};

/** Valores de ANTES do PL-01 (guardados; usados com o modo crescimento DESLIGADO). */
export const LIMITES_ORIGINAIS: Readonly<Record<PlanoSlug, LimitesDoPlano>> = {
  free:     { maxObjetos: 3,   maxPorDia: null },
  pro:      { maxObjetos: 50,  maxPorDia: null },
  business: { maxObjetos: 500, maxPorDia: null },
};

export const limitesDosPlanos = (crescimento: boolean = modoCrescimento()) => (crescimento ? LIMITES_CRESCIMENTO : LIMITES_ORIGINAIS);

export function limitesDoPlano(plano: string | null | undefined, crescimento: boolean = modoCrescimento()): LimitesDoPlano {
  const t = limitesDosPlanos(crescimento);
  return t[(plano as PlanoSlug) in t ? (plano as PlanoSlug) : 'free'];
}

/** Status que NÃO ocupam vaga no limite (resolvidos/apagados). */
export const STATUS_QUE_NAO_CONTAM = ['deleted', 'archived', 'returned'] as const;

export function mensagemDeLimite(tipo: 'total' | 'diario', plano: string, lim: LimitesDoPlano, crescimento: boolean = modoCrescimento()): string {
  if (!crescimento) {
    // Texto ORIGINAL (antes do PL-01)
    return `Você atingiu o limite de ${lim.maxObjetos} objeto${lim.maxObjetos !== 1 ? 's' : ''} do plano ${plano}. Faça upgrade para adicionar mais.`;
  }
  if (tipo === 'diario') {
    return `Você já cadastrou ${lim.maxPorDia} ocorrências nas últimas 24 horas (limite diário do plano ${plano}). Tente de novo mais tarde.`;
  }
  return `Você atingiu o limite de ${lim.maxObjetos} objetos ativos do plano ${plano}. Arquive ou marque como devolvidos os que já foram resolvidos para continuar cadastrando.`;
}
