// Limite de pedidos por origem (IP) para a validação do código do colaborador. Em memória, por instância do servidor (como o do Feed):
// freia varredura simples de códigos; NÃO é uma barreira global. Módulo próprio do programa (não reutiliza o do Feed).
export const LIMITE_VALIDACAO_POR_MINUTO = 30;
const JANELA_MS = 60_000, MAX_CHAVES = 5000;
const usos = new Map<string, { inicio: number; n: number }>();

/** true = passou do limite (recusar). */
export function limitarValidacao(origem: string, agora = Date.now()): boolean {
  if (usos.size > MAX_CHAVES) usos.clear();
  const u = usos.get(origem);
  if (!u || agora - u.inicio >= JANELA_MS) { usos.set(origem, { inicio: agora, n: 1 }); return false; }
  u.n += 1;
  return u.n > LIMITE_VALIDACAO_POR_MINUTO;
}
export function resetLimiteValidacao() { usos.clear(); }
