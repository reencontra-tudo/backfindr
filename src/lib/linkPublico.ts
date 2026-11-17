// Validade dos links públicos de custódia (/custody/<token>) e de entrega (/delivery/<token>).
//
// Regra vigente (opção B): o link vale enquanto a custódia/entrega estiver ATIVA e por um prazo depois de
// CONCLUÍDA (entregue ou cancelada). Passado o prazo, a página pública mostra só "concluída", sem nome,
// telefone, endereço nem qualquer dado pessoal. Nada é apagado: a expiração é calculada na leitura a partir
// de datas que já existem e a primeira leitura depois do prazo grava um evento no histórico.
//
// ÚNICO lugar com o prazo e com a regra. As rotas públicas (src/app/api/v1/custody/link e
// src/app/api/v1/delivery/link) usam estas funções; não há número de dias em nenhum outro arquivo.

export type TipoLink = 'custodia' | 'entrega';

/** Dias de validade depois da conclusão, por tipo (valor inicial: 7 para ambos). Altere só aqui. */
export const PRAZO_POS_CONCLUSAO_DIAS: Readonly<Record<TipoLink, number>> = {
  custodia: 7,
  entrega: 7,
};

/** Status que encerram a custódia/entrega. Qualquer outro valor conta como ativo (como sempre foi). */
export const STATUS_CONCLUIDOS = ['entregue', 'cancelado'] as const;

export type EstadoLink = 'ativo' | 'concluido_no_prazo' | 'expirado';

// Aceita Date ou texto. O texto no formato do Postgres («2026-03-05 12:00:00+00», sem minutos no deslocamento)
// não é entendido pelo Date do JavaScript; aqui vira ISO antes de converter. Data inválida = NaN.
function paraInstante(v: Date | string | null | undefined): number {
  if (v == null) return NaN;
  if (v instanceof Date) return v.getTime();
  const iso = v.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, '$1T$2').replace(/([+-]\d{2})$/, '$1:00');
  return new Date(iso).getTime();
}

const MS_POR_DIA = 24 * 60 * 60 * 1000; // dia = 24 h exatas (instantes absolutos: não depende de fuso nem de horário de verão)

export function estaConcluido(status: string | null | undefined): boolean {
  return (STATUS_CONCLUIDOS as readonly string[]).includes(status ?? '');
}

/** Último instante em que o link ainda abre (inclusive). */
export function limiteDoLink(tipo: TipoLink, concluidaEm: Date): Date {
  return new Date(concluidaEm.getTime() + PRAZO_POS_CONCLUSAO_DIAS[tipo] * MS_POR_DIA);
}

/**
 * Decide o estado do link.
 *  - ativo: ainda não foi concluído (sem prazo: vale enquanto estiver ativo);
 *  - concluido_no_prazo: concluído há no máximo o prazo (o limite exato ainda vale);
 *  - expirado: concluído há mais que o prazo, ou concluído sem data conhecida (na dúvida, não mostra dado).
 */
export function estadoDoLink(
  tipo: TipoLink,
  dados: { status: string | null | undefined; concluidaEm: Date | string | null | undefined; agora: Date | string },
): EstadoLink {
  if (!estaConcluido(dados.status)) return 'ativo';
  const concluida = paraInstante(dados.concluidaEm);
  const agora = paraInstante(dados.agora);
  if (!Number.isFinite(concluida) || !Number.isFinite(agora)) return 'expirado';
  return agora > concluida + PRAZO_POS_CONCLUSAO_DIAS[tipo] * MS_POR_DIA ? 'expirado' : 'concluido_no_prazo';
}

/** Resposta pública do link expirado: só o estado. Nada da custódia/entrega vai junto. */
export const RESPOSTA_LINK_EXPIRADO = Object.freeze({
  estado: 'concluida' as const,
  detail: 'Concluída. Este link não está mais disponível.',
});
export const STATUS_HTTP_LINK_EXPIRADO = 410; // Gone: existiu e não está mais disponível (token inexistente continua 404)

// ── SQL ────────────────────────────────────────────────────────────────────────────────────────────────
// Instante da conclusão, a partir do que o banco já guarda (nenhuma coluna nova): entregue_em; senão o evento
// 'entregue'/'cancelado' mais antigo do histórico; senão updated_at (depois de concluída, nenhuma rota mexe
// mais na linha). NULL enquanto ativa.
const LISTA_CONCLUIDOS = STATUS_CONCLUIDOS.map((s) => `'${s}'`).join(', ');

export const SQL_CUSTODIA_CONCLUIDA_EM = `CASE WHEN c.status IN (${LISTA_CONCLUIDOS}) THEN COALESCE(c.entregue_em, (SELECT MIN(ev.created_at) FROM custody_eventos ev WHERE ev.custodia_id = c.id AND ev.tipo IN (${LISTA_CONCLUIDOS})), c.updated_at) END`;

export const SQL_ENTREGA_CONCLUIDA_EM = `CASE WHEN e.status IN (${LISTA_CONCLUIDOS}) THEN COALESCE(e.entregue_em, (SELECT MIN(ev.created_at) FROM entrega_eventos ev WHERE ev.entrega_id = e.id AND ev.tipo IN (${LISTA_CONCLUIDOS})), e.updated_at) END`;

export const TIPO_EVENTO_LINK_EXPIRADO = 'link_expirado';

// Grava no histórico, UMA vez por registro, que o link passou a expirado (na primeira leitura depois do prazo).
// Nunca quebra a resposta: falha de gravação é ignorada.
export async function registrarLinkExpirado(
  consultar: (texto: string, params?: unknown[]) => Promise<unknown>,
  tipo: TipoLink,
  id: string,
  concluidaEm: Date | string,
): Promise<void> {
  const instante = paraInstante(concluidaEm);
  if (!Number.isFinite(instante)) return;
  const expiraEm = limiteDoLink(tipo, new Date(instante)).toISOString();
  const observacao = `Link público encerrado: ${PRAZO_POS_CONCLUSAO_DIAS[tipo]} dias depois da conclusão (até ${expiraEm})`;
  const tabela = tipo === 'custodia' ? 'custody_eventos' : 'entrega_eventos';
  const coluna = tipo === 'custodia' ? 'custodia_id' : 'entrega_id';
  try {
    await consultar(
      `INSERT INTO ${tabela} (${coluna}, tipo, observacao)
       SELECT $1::uuid, $2::varchar, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM ${tabela} WHERE ${coluna} = $1::uuid AND tipo = $2::varchar)`,
      [id, TIPO_EVENTO_LINK_EXPIRADO, observacao],
    );
  } catch (e) {
    // O histórico é um complemento: a resposta ao visitante não depende dele. Mas a falha não fica muda.
    console.error('[linkPublico] não foi possível registrar o evento de expiração:', e instanceof Error ? e.message : e);
  }
}
