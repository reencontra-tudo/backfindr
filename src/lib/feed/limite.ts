// Limite simples de pedidos por origem (IP) para a API de contexto do /achei. Em memória, por instância do servidor.
// Limite de pedidos por origem (IP): 30 por minuto. Em memória, por instância do servidor: freia varredura simples; não é uma barreira global.
export const LIMITE_POR_MINUTO = 30;
const JANELA_MS = 60_000, LIMITE = LIMITE_POR_MINUTO, MAX_CHAVES = 5000;
const usos = new Map<string, { inicio: number; n: number }>();
export function limitar(ip: string, agora = Date.now()): boolean {
  if (usos.size > MAX_CHAVES) usos.clear();
  const u = usos.get(ip);
  if (!u || agora - u.inicio >= JANELA_MS) { usos.set(ip, { inicio: agora, n: 1 }); return false; }
  u.n += 1;
  return u.n > LIMITE;
}
export function resetLimite() { usos.clear(); }


