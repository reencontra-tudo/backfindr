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
