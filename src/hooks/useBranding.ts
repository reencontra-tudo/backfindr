'use client';

import { useMemo } from 'react';

export interface CondominiobrAndIng {
  nome:                 string;
  slug:                 string;
  logo_url:             string | null;
  banner_url:           string | null;
  cor_primaria:         string | null;
  cor_texto:            string | null;
  mensagem_boas_vindas: string | null;
  cidade:               string;
  estado:               string;
  total_unidades:       number;
}

const DEFAULT_BRANDING = {
  cor_primaria: '#14B8A6',  // teal-500 — cor padrão do Backfindr
  cor_texto:    '#FFFFFF',
};

/**
 * useBranding
 * Recebe os dados do condomínio e retorna
 * estilos CSS prontos para aplicar inline.
 *
 * Uso:
 *   const { styles, branding } = useBranding(condominio);
 *   <button style={styles.button}>...</button>
 */
export function useBranding(condominio: Partial<CondominiobrAndIng> | null) {
  const cor    = condominio?.cor_primaria ?? DEFAULT_BRANDING.cor_primaria;
  const texto  = condominio?.cor_texto   ?? DEFAULT_BRANDING.cor_texto;

  const styles = useMemo(() => ({
    // Botão primário
    button: {
      background: cor,
      color:      texto,
    } as React.CSSProperties,

    // Badge / pill de destaque
    badge: {
      background: `${cor}22`,
      color:      cor,
      border:     `1px solid ${cor}44`,
    } as React.CSSProperties,

    // Borda de foco em inputs
    inputFocus: {
      borderColor: `${cor}80`,
      outline:     'none',
    } as React.CSSProperties,

    // Barra de progresso
    progressBar: {
      background: cor,
    } as React.CSSProperties,

    // Dot / indicador
    dot: {
      background: cor,
    } as React.CSSProperties,

    // Header com gradiente sutil
    headerGradient: {
      background: `linear-gradient(180deg, ${cor}18 0%, transparent 100%)`,
    } as React.CSSProperties,

    // Linha de destaque
    accent: {
      color: cor,
    } as React.CSSProperties,
  }), [cor, texto]);

  return { styles, cor, texto, branding: condominio };
}

/**
 * Utilitário — gera classe Tailwind inline via CSS var
 * Para casos onde não é possível usar style prop
 */
export function brandingVars(cor: string, texto: string) {
  return {
    '--brand-color':  cor,
    '--brand-text':   texto,
  } as React.CSSProperties;
}
