// Aviso ao Healthchecks.io (monitoramento de fora do Backfindr) ao fim de cada rotina agendada.
//
// O Healthchecks avisa o Marcos (Telegram e e-mail) quando o sinal FALTA ou quando chega /fail. Por isso:
//  • Sucesso (status abaixo de 400, inclusive o matching com a chave desligada): GET na URL de ping da rotina.
//  • Erro (status 400 ou mais, ou a rotina lançar exceção): GET na URL de ping + /fail; se houve exceção, ela é relançada igual.
//  • Segredo errado (401) NÃO passa por aqui: a rota confere o segredo ANTES de chamar comPing, então não há ping de sucesso nem /fail
//    (o silêncio é o que faz o Healthchecks avisar).
//  • O ping nunca muda a resposta, o status, os efeitos nem a duração relevante da rotina: try/catch total e limite de espera de 1,5 s.
//    Espera-se o ping antes de devolver a resposta, porque na Vercel a função congela depois de responder.
//  • Sem a variável de ambiente da rotina: não faz nada, em silêncio.
//  • A URL de ping é semi-segredo (quem a conhece pode forjar sinal de vida): nunca vai para log, resposta nem erro. O ping não leva corpo nem dado algum.

/** Nomes das variáveis com a URL de ping de cada rotina agendada (só os NOMES; os valores ficam na Vercel). */
export const VARIAVEIS_DE_PING = {
  matching: 'HC_PING_MATCHING',
  foundPending: 'HC_PING_FOUND_PENDING',
  ingestao: 'HC_PING_INGESTAO',
} as const;

export type VariavelDePing = (typeof VARIAVEIS_DE_PING)[keyof typeof VARIAVEIS_DE_PING];

const LIMITE_DO_PING_MS = 1500;

async function pingar(variavel: VariavelDePing, falha: boolean): Promise<void> {
  const timers: ReturnType<typeof setTimeout>[] = [];
  try {
    const base = process.env[variavel]?.trim();
    if (!base) return; // sem a variável: nada a fazer
    const url = falha ? `${base.replace(/\/+$/, '')}/fail` : base;
    const controle = new AbortController();
    timers.push(setTimeout(() => controle.abort(), LIMITE_DO_PING_MS));
    const enviar = fetch(url, { method: 'GET', signal: controle.signal, cache: 'no-store' }).then(() => undefined).catch(() => undefined);
    const limite = new Promise<void>((resolve) => { timers.push(setTimeout(resolve, LIMITE_DO_PING_MS)); });
    await Promise.race([enviar, limite]);
  } catch {
    /* o ping é só um aviso a mais: nunca altera a rotina e nunca registra a URL */
  } finally {
    timers.forEach((t) => clearTimeout(t));
  }
}

/**
 * Executa a rotina e avisa o Healthchecks. Chamar DEPOIS de conferir o segredo da rota.
 * A resposta da rotina é devolvida exatamente como veio (o corpo não é lido).
 */
export async function comPing<T extends Response>(variavel: VariavelDePing, executar: () => Promise<T>): Promise<T> {
  let resposta: T;
  try {
    resposta = await executar();
  } catch (erro) {
    await pingar(variavel, true);
    throw erro;
  }
  await pingar(variavel, resposta.status >= 400);
  return resposta;
}
