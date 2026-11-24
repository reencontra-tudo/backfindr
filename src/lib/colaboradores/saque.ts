// Programa de Colaboradores (E6): dados de pagamento e PEDIDO DE SAQUE. SOMENTE SERVIDOR. O dinheiro só se move por lançamentos do livro (E4):
// `saque_reservado` (negativo, na hora do pedido), `saque_cancelado` (positivo, se o colaborador cancela) e, no E7, `saque_pago` (admin). O repasse é manual por PIX, em até 10 dias
// úteis (dias de semana, sem feriados) depois do pedido (POLÍTICA §4). Valor mínimo e prazo vêm de `programa_config` (R$ 50 e 10).
// INTERRUPTORES: `COLABORADORES_SALDO=1` (mostrar saldo no painel) e `COLABORADORES_SAQUE=1` (dados de pagamento e saque), além da inscrição (`COLABORADORES_ATIVO` e `COLABORADORES_INSCRICAO`).
import { saldoDoColaborador, type Consulta, type Transacao } from './comissao';
import { cifrar, finalDe, type DadosPagamento } from './pagamento';
import { inscricaoAtiva } from './inscricao';

export const saldoVisivel = (env: Record<string, string | undefined> = process.env) => inscricaoAtiva(env) && env.COLABORADORES_SALDO === '1';
export const saqueAtivo = (env: Record<string, string | undefined> = process.env) => saldoVisivel(env) && env.COLABORADORES_SAQUE === '1';

export const SAQUE_MINIMO_PADRAO_CENTAVOS = 5000;
export const PRAZO_SAQUE_DIAS_UTEIS_PADRAO = 10;

export async function saqueMinimoCentavos(consulta: Consulta, quando: Date = new Date()): Promise<number> {
  try {
    const r = await consulta(`SELECT valor FROM programa_config WHERE chave = 'saque_minimo_centavos' AND vigente_desde <= $1 ORDER BY vigente_desde DESC LIMIT 1`, [quando.toISOString()]);
    const n = Number(r.rows[0]?.valor); return Number.isInteger(n) && n > 0 ? n : SAQUE_MINIMO_PADRAO_CENTAVOS;
  } catch { return SAQUE_MINIMO_PADRAO_CENTAVOS; }
}

/** Soma `n` dias ÚTEIS (segunda a sexta; sem feriados: decisão do fundador) a partir de `de`. */
export function somarDiasUteis(de: Date, n: number): Date {
  const d = new Date(de.getTime()); let falta = n;
  while (falta > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) falta--; }
  return d;
}

export interface DadosPagamentoMascarados { tipoChave: string; chaveFinal: string; titularNome: string; documentoTipo: string; documentoFinal: string }

export async function salvarDadosPagamento(consulta: Consulta, colaboradorId: string, d: DadosPagamento, env: Record<string, string | undefined> = process.env): Promise<void> {
  // cifrar() lança CifragemIndisponivel sem a chave: nunca grava em claro.
  const chaveCif = cifrar(d.chave, env); const docCif = cifrar(d.documento, env);
  await consulta(
    `INSERT INTO colaborador_dados_pagamento (colaborador_id, tipo_chave, chave_cifrada, chave_final, titular_nome, documento_tipo, documento_cifrado, documento_final)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (colaborador_id) DO UPDATE SET tipo_chave = EXCLUDED.tipo_chave, chave_cifrada = EXCLUDED.chave_cifrada, chave_final = EXCLUDED.chave_final, titular_nome = EXCLUDED.titular_nome,
       documento_tipo = EXCLUDED.documento_tipo, documento_cifrado = EXCLUDED.documento_cifrado, documento_final = EXCLUDED.documento_final, atualizado_em = NOW()`,
    [colaboradorId, d.tipoChave, chaveCif, finalDe(d.chave), d.titularNome, d.documentoTipo, docCif, finalDe(d.documento)],
  );
}

export async function lerDadosPagamento(consulta: Consulta, colaboradorId: string): Promise<DadosPagamentoMascarados | null> {
  const r = await consulta(`SELECT tipo_chave, chave_final, titular_nome, documento_tipo, documento_final FROM colaborador_dados_pagamento WHERE colaborador_id = $1`, [colaboradorId]);
  const x = r.rows[0]; if (!x) return null;
  return { tipoChave: String(x.tipo_chave), chaveFinal: String(x.chave_final), titularNome: String(x.titular_nome), documentoTipo: String(x.documento_tipo), documentoFinal: String(x.documento_final) };
}

export type ResultadoSaque =
  | { ok: true; saque: { id: string; valorCentavos: number; previstoAte: string } }
  | { ok: false; erro: 'NAO_ENCONTRADO' | 'NAO_VERIFICADO' | 'SEM_DADOS_PAGAMENTO' | 'SAQUE_ABERTO' | 'SALDO_INSUFICIENTE'; disponivelCentavos?: number; minimoCentavos?: number };

/** Pede o saque de TODO o saldo disponível (precisa atingir o mínimo). Transação própria; reserva o valor no livro na hora (o saldo disponível cai). */
export async function solicitarSaque(tx: Transacao, userId: string, agora: Date = new Date()): Promise<ResultadoSaque> {
  await tx.query('BEGIN');
  try {
    const c = await tx.query(`SELECT id, (verificado_em IS NOT NULL) AS verificado FROM colaboradores WHERE user_id = $1 AND estado = 'ativo' AND interno = FALSE FOR UPDATE`, [userId]);
    if (c.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    const id = String(c.rows[0].id);
    if (c.rows[0].verificado !== true) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_VERIFICADO' }; }
    const dados = await tx.query('SELECT 1 FROM colaborador_dados_pagamento WHERE colaborador_id = $1', [id]);
    if (dados.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'SEM_DADOS_PAGAMENTO' }; }
    const aberto = await tx.query(`SELECT 1 FROM colaborador_saques WHERE colaborador_id = $1 AND estado = 'solicitado'`, [id]);
    if (aberto.rows.length > 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'SAQUE_ABERTO' }; }
    const consulta: Consulta = (t, p) => tx.query(t, p);
    const saldo = await saldoDoColaborador(consulta, id, agora); const minimo = await saqueMinimoCentavos(consulta, agora);
    if (saldo.disponivelCentavos < minimo) { await tx.query('ROLLBACK'); return { ok: false, erro: 'SALDO_INSUFICIENTE', disponivelCentavos: Math.max(saldo.disponivelCentavos, 0), minimoCentavos: minimo }; }
    const s = await tx.query(`INSERT INTO colaborador_saques (colaborador_id, valor_centavos, solicitado_em) VALUES ($1,$2,$3) RETURNING id`, [id, saldo.disponivelCentavos, agora.toISOString()]);
    const sid = String(s.rows[0].id);
    await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo) VALUES ($1,'saque_reservado',$2,$3,'saque solicitado')`, [id, -saldo.disponivelCentavos, `saque:${sid}`]);
    await tx.query('COMMIT');
    return { ok: true, saque: { id: sid, valorCentavos: saldo.disponivelCentavos, previstoAte: somarDiasUteis(agora, PRAZO_SAQUE_DIAS_UTEIS_PADRAO).toISOString() } };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

/** O próprio colaborador cancela o pedido ainda aberto: o valor volta ao saldo (lançamento `saque_cancelado`). */
export async function cancelarSaque(tx: Transacao, userId: string, agora: Date = new Date()): Promise<{ ok: true; valorCentavos: number } | { ok: false; erro: 'NAO_ENCONTRADO' | 'SEM_SAQUE_ABERTO' }> {
  await tx.query('BEGIN');
  try {
    const c = await tx.query(`SELECT id FROM colaboradores WHERE user_id = $1 AND interno = FALSE FOR UPDATE`, [userId]);
    if (c.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    const id = String(c.rows[0].id);
    const s = await tx.query(`SELECT id, valor_centavos FROM colaborador_saques WHERE colaborador_id = $1 AND estado = 'solicitado' FOR UPDATE`, [id]);
    if (s.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'SEM_SAQUE_ABERTO' }; }
    const sid = String(s.rows[0].id); const valor = Number(s.rows[0].valor_centavos);
    await tx.query(`UPDATE colaborador_saques SET estado = 'cancelado', decidido_em = $2, motivo = 'cancelado pelo colaborador' WHERE id = $1`, [sid, agora.toISOString()]);
    await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo) VALUES ($1,'saque_cancelado',$2,$3,'cancelado pelo colaborador')`, [id, valor, `saque_cancelado:${sid}`]);
    await tx.query('COMMIT');
    return { ok: true, valorCentavos: valor };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

export async function listarSaques(consulta: Consulta, colaboradorId: string) {
  const r = await consulta(`SELECT id, valor_centavos, estado, solicitado_em, decidido_em, motivo FROM colaborador_saques WHERE colaborador_id = $1 ORDER BY solicitado_em DESC LIMIT 50`, [colaboradorId]);
  return r.rows;
}
