// Tema da área do Feed (/feed): faixa escura no topo + «folha» clara. TUDO que muda de cor está aqui, em variáveis CSS (--f-*),
// aplicadas uma única vez no <main> da página. As classes dos componentes só usam `var(--f-...)`.
//
// PARA VOLTAR AO ESCURO DE HOJE (comparar com o Feed de produção): troque `TEMA_ATIVO = TEMA_CLARO` por `TEMA_ATIVO = TEMA_ESCURO` no fim deste arquivo.
// Não há seletor claro/escuro para o visitante: é um tema só por vez.
import type { CSSProperties } from 'react';

export type TemaFeed = Record<`--f-${string}`, string>;

/** Pares texto/fundo usados no tema claro e a razão mínima que a WCAG AA exige (4,5 texto normal; 3 componente/texto grande). Medidos em tests/feed-visualizacao.test.ts. */
export const TEMA_CLARO: TemaFeed = {
  '--f-faixa': '#0b1f3a',            // azul-marinho da marca: fundo da faixa do topo
  '--f-faixa-t': '#ffffff',
  '--f-folha': '#ffffff',            // folha clara
  '--f-t1': '#0f172a',               // texto principal
  '--f-t2': '#334155',               // texto secundário
  '--f-t3': '#475569',               // meta (local, tempo, fonte)
  '--f-linha': '#e2e8f0',            // separadores
  '--f-borda': '#64748b',            // contorno de controles (chips, campos, botões)
  '--f-hover': '#f1f5f9',
  '--f-campo': '#ffffff',
  '--f-chip-ativo': '#0f766e', '--f-chip-ativo-t': '#ffffff',
  '--f-prim': '#0f766e', '--f-prim-t': '#ffffff', '--f-prim-hover': '#115e59',
  '--f-acao-t': '#0f766e',           // «Informar que encontrei» e links de ação
  '--f-foco': '#0d9488',
  '--f-perdido': '#b91c1c', '--f-achado': '#15803d', '--f-roubado': '#6d28d9',            // texto/selo de situação (selo: texto branco)
  '--f-perdido-ponto': '#dc2626', '--f-achado-ponto': '#16a34a', '--f-roubado-ponto': '#7c3aed',
  '--f-perdido-suave': '#fef2f2', '--f-achado-suave': '#f0fdf4', '--f-roubado-suave': '#f5f3ff',   // fundo suave do card sem foto na Grade
  '--f-selo-t': '#ffffff',
  '--f-aviso': '#f1f5f9',            // blocos (explicativo, convite do fim)
  '--f-faixa-sombra': 'rgba(15,23,42,0.22)',
  '--f-sombra': '0 1px 2px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)',
};

/** O visual de hoje (tudo escuro). */
export const TEMA_ESCURO: TemaFeed = {
  '--f-faixa': '#080b0f', '--f-faixa-t': '#ffffff',
  '--f-folha': '#080b0f',
  '--f-t1': '#ffffff', '--f-t2': 'rgba(255,255,255,0.8)', '--f-t3': 'rgba(255,255,255,0.7)',
  '--f-linha': 'rgba(255,255,255,0.1)', '--f-borda': 'rgba(255,255,255,0.25)', '--f-hover': 'rgba(255,255,255,0.1)', '--f-campo': '#10151c',
  '--f-chip-ativo': 'rgba(20,184,166,0.25)', '--f-chip-ativo-t': '#ffffff',
  '--f-prim': '#14b8a6', '--f-prim-t': '#04110f', '--f-prim-hover': '#2dd4bf',
  '--f-acao-t': '#ccfbf1', '--f-foco': '#2dd4bf',
  '--f-perdido': '#fde68a', '--f-achado': '#99f6e4', '--f-roubado': '#fecaca',
  '--f-perdido-ponto': '#fcd34d', '--f-achado-ponto': '#5eead4', '--f-roubado-ponto': '#fca5a5',
  '--f-perdido-suave': 'rgba(255,255,255,0.06)', '--f-achado-suave': 'rgba(255,255,255,0.06)', '--f-roubado-suave': 'rgba(255,255,255,0.06)',
  '--f-selo-t': '#ffffff',
  '--f-aviso': 'rgba(255,255,255,0.05)',
  '--f-faixa-sombra': 'rgba(255,255,255,0.28)',
  '--f-sombra': 'none',
};

export const TEMA_ATIVO: TemaFeed = TEMA_CLARO;
export const temaStyle = (t: TemaFeed = TEMA_ATIVO) => t as unknown as CSSProperties;

/** Classes por papel (todas apontam para as variáveis acima). Os componentes usam estes nomes; nenhuma cor fica espalhada. */
export const T = {
  t1: 'text-[color:var(--f-t1)]', t2: 'text-[color:var(--f-t2)]', t3: 'text-[color:var(--f-t3)]',
  linha: 'border-[color:var(--f-linha)]', divide: 'divide-[color:var(--f-linha)]',
  borda: 'border-[color:var(--f-borda)]', hover: 'hover:bg-[color:var(--f-hover)]',
  foco: 'focus:ring-[color:var(--f-foco)]',
  aviso: 'bg-[color:var(--f-aviso)]', folha: 'bg-[color:var(--f-folha)]',
  prim: 'bg-[color:var(--f-prim)] text-[color:var(--f-prim-t)] hover:bg-[color:var(--f-prim-hover)]',
  acao: 'text-[color:var(--f-acao-t)]',
} as const;

export const SITUACAO = {
  lost:   { texto: 'text-[color:var(--f-perdido)]', ponto: 'bg-[color:var(--f-perdido-ponto)]', selo: 'bg-[color:var(--f-perdido)]', suave: 'bg-[color:var(--f-perdido-suave)]' },
  found:  { texto: 'text-[color:var(--f-achado)]',  ponto: 'bg-[color:var(--f-achado-ponto)]',  selo: 'bg-[color:var(--f-achado)]',  suave: 'bg-[color:var(--f-achado-suave)]' },
  stolen: { texto: 'text-[color:var(--f-roubado)]', ponto: 'bg-[color:var(--f-roubado-ponto)]', selo: 'bg-[color:var(--f-roubado)]', suave: 'bg-[color:var(--f-roubado-suave)]' },
} as const;
