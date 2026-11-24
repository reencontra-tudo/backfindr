// Limpeza de texto livre do programa: tira caracteres de controle e de inversão de texto e normaliza espaços.
export const semControleTexto = (t: string): string => t.replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
