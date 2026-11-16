// Marca de vida das rotinas agendadas: uma linha em rotina_execucoes por chamada AUTENTICADA (migration 026).
//
// Princípios (todos testados):
//  • A marca só é gravada DEPOIS de a rota conferir o segredo. Segredo errado responde 401 como sempre e não grava nada.
//  • Gravar é só um efeito a mais: toda a gravação está em try/catch, tem limite de tempo curto e NUNCA muda a resposta, o status HTTP nem os efeitos da rotina.
//  • Sem a tabela (migration ainda não aplicada) ou com qualquer falha, a rotina segue idêntica e em silêncio.
//  • O resumo guarda só CONTAGENS (números e verdadeiro/falso). Texto, listas e mensagens de erro nunca vão para a marca.
import { query } from '@/lib/db';

export type ResultadoMarca = 'ok' | 'erro' | 'desligada';

/** Limite de espera pela gravação: um banco lento não pode atrasar a rotina. */
const LIMITE_GRAVACAO_MS = 1500;

let avisouFaltaDaTabela = false;

/** Reduz o corpo da resposta a contagens: números, verdadeiro/falso, tamanho de listas (`campo_n`) e os números de `stats`. */
export function resumoSeguro(corpo: unknown): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return out;
  const nivel = (obj: Record<string, unknown>, prefixo: string) => {
    for (const [k, v] of Object.entries(obj)) {
      if (Object.keys(out).length >= 30) return;
      if (typeof v === 'number' && Number.isFinite(v)) out[`${prefixo}${k}`] = v;
      else if (typeof v === 'boolean') out[`${prefixo}${k}`] = v;
      else if (Array.isArray(v)) out[`${prefixo}${k}_n`] = v.length;
    }
  };
  const base = corpo as Record<string, unknown>;
  nivel(base, '');
  const stats = base.stats;
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) nivel(stats as Record<string, unknown>, 'stats_');
  return out;
}

/** Resultado da marca a partir da resposta: status 400+ = erro; corpo com `ativo: false` = desligada; o resto = ok. */
export function resultadoDaResposta(status: number, corpo: unknown): ResultadoMarca {
  if (status >= 400) return 'erro';
  if (corpo && typeof corpo === 'object' && (corpo as { ativo?: unknown }).ativo === false) return 'desligada';
  return 'ok';
}

/** Grava a marca. Nunca lança e nunca espera mais que o limite. */
export async function gravarMarca(rotina: string, iniciouEm: Date, resultado: ResultadoMarca, resumo: Record<string, number | boolean>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const gravar = query(
      `INSERT INTO rotina_execucoes (rotina, iniciou_em, terminou_em, resultado, resumo) VALUES ($1, $2, NOW(), $3, $4::jsonb)`,
      [rotina, iniciouEm.toISOString(), resultado, JSON.stringify(resumo)],
    ).then(() => undefined).catch((err: unknown) => {
      // Tabela ausente (migration 026 ainda não aplicada) ou qualquer outra falha: segue em silêncio (um único aviso curto por processo).
      if (!avisouFaltaDaTabela) { avisouFaltaDaTabela = true; console.warn('[rotinaMarca] marca não gravada:', (err as { code?: string })?.code ?? 'erro'); }
    });
    const limite = new Promise<void>((resolve) => { timer = setTimeout(resolve, LIMITE_GRAVACAO_MS); });
    await Promise.race([gravar, limite]);
  } catch {
    /* nada: a marca é só um efeito a mais */
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Executa a rotina e grava a marca. Chamar DEPOIS de conferir o segredo.
 * A resposta da rotina é devolvida exatamente como veio; o corpo só é lido numa CÓPIA, para tirar as contagens.
 * Se a rotina lançar um erro, grava 'erro' e relança o mesmo erro.
 */
export async function comMarca<T extends Response>(rotina: string, executar: () => Promise<T>): Promise<T> {
  const iniciouEm = new Date();
  let resposta: T;
  try {
    resposta = await executar();
  } catch (erro) {
    await gravarMarca(rotina, iniciouEm, 'erro', {});
    throw erro;
  }
  let corpo: unknown = null;
  try { corpo = await resposta.clone().json(); } catch { /* corpo que não é JSON: marca sem contagens */ }
  await gravarMarca(rotina, iniciouEm, resultadoDaResposta(resposta.status, corpo), resumoSeguro(corpo));
  return resposta;
}
