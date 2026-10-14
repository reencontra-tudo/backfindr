/**
 * Aguarda envios (e-mail/push) já iniciados antes de a rota responder.
 *
 * Em funções serverless, trabalho pendente depois da resposta não é garantido:
 * a chamada pode ser interrompida quando a função termina. Os envios abaixo
 * dependem de uma consulta ao banco antes da chamada externa, então só
 * completam de forma confiável se a rota esperar por eles.
 *
 * Cada promessa recebida deve já tratar o próprio erro (`.catch`), como no
 * código original; esta função nunca lança e nunca altera a resposta da rota.
 * O limite de tempo evita que um destino lento segure a resposta ao visitante.
 */
export async function awaitSends(tasks: Array<Promise<unknown>>, maxMs = 10_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, maxMs);
  });
  try {
    await Promise.race([Promise.allSettled(tasks), limit]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Tempo de espera para rotas longas (matching em lote): o menor entre o teto
 * pedido e o que sobra do orçamento da função. Assim a espera dos envios nunca
 * empurra a rota para além do limite de duração (300 s no plano atual, com
 * margem), mesmo que o processamento já tenha consumido quase todo o tempo.
 * Sem tempo sobrando, devolve 0 e a rota responde como respondia antes.
 */
export function sendWaitBudget(startedAtMs: number, capMs: number, routeLimitMs = 280_000): number {
  return Math.max(0, Math.min(capMs, routeLimitMs - (Date.now() - startedAtMs)));
}
