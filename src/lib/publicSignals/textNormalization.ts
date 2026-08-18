// ─── Normalização de texto PT-BR compartilhada ─────────────────────────────
// Mesma lógica usada em src/app/api/v1/matching/run/route.ts e
// src/app/api/v1/objects/public/route.ts (hoje duplicada nos dois — extraída
// aqui só para o uso novo do Public Signals, sem tocar nas duas rotas
// existentes nesta rodada).

// ATENÇÃO — removerAcentos: dentro dos colchetes do regex abaixo estão os
// próprios caracteres Unicode dos diacríticos combinantes, code points
// U+0300 a U+036F (faixa padrão de acentos combinantes gerada por
// str.normalize('NFD')), digitados literais em vez de notação de escape —
// por um problema de encoding entre as camadas de ferramentas que geraram
// este arquivo, que converte a notação de escape correspondente de volta
// nesses mesmos caracteres literais sempre que se tenta reescrevê-la aqui.
// Testado isoladamente e confirmado funcionalmente equivalente à notação de
// escape ("São" → "Sao"). NÃO tente "arrumar" isso sem rodar esse teste de
// novo — é fácil reintroduzir o mesmo problema de encoding sem perceber.
export function removerAcentos(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizarPalavra(word: string): string {
  word = removerAcentos(word).toLowerCase().trim();
  if (word.length > 4 && word.endsWith('s')) word = word.slice(0, -1);
  return word;
}

export function tokenizar(text: string): string[] {
  return removerAcentos(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
}
