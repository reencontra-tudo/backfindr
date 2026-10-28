/**
 * Ponto de entrada da instrução fixa de posicionamento para geradores de texto com IA
 * (chatbot, Comunidade, páginas de cidade, respostas de growth, AutoPost e anúncios).
 *
 * VAZIO DE PROPÓSITO: o texto depende da frase de definição do Backfindr, decisão ainda pendente
 * do responsável pelo produto. Enquanto POSITIONING_INSTRUCTION for vazio, withPositioning()
 * devolve o prompt sem nenhuma alteração (nenhum comportamento muda e nenhum gerador a usa ainda).
 *
 * Quando houver definição, escrever aqui UM bloco com: a frase de definição; a ordem
 * função principal → possíveis correspondências → QR Code opcional e depois; a regra de não
 * afirmar número ou comparação sem entrada no registro de afirmações (BACKFINDR.md, seção 9-B);
 * e a regra de não citar parceiros, coleiras nem adesivos à venda. Depois, aplicar
 * withPositioning() ao prompt de cada gerador.
 */
export const POSITIONING_INSTRUCTION = '';

export function withPositioning(prompt: string): string {
  return POSITIONING_INSTRUCTION ? `${POSITIONING_INSTRUCTION}\n\n${prompt}` : prompt;
}
