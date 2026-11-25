// Programa de Colaboradores (E8): SINAIS de antifraude para ANÁLISE MANUAL. SOMENTE SERVIDOR. Nunca bloqueia uma pessoa sozinho: um sinal de COMPRA retém aquela comissão fora do saldo
// DISPONÍVEL até o admin decidir (descartar libera; confirmar mantém retida); um sinal do COLABORADOR só avisa. O livro de lançamentos continua só-INSERT (a retenção vem da tabela de sinais).
// INTERRUPTOR: `COLABORADORES_ANTIFRAUDE=1` (além de `COLABORADORES_ATIVO=1`). Ausente = DESLIGADO: nada é lido nem gravado e o saldo é calculado como antes.
// PRIVACIDADE: o `detalhe` do sinal guarda só números e tipos; nunca e-mail, nome, IP ou identificador de pessoa. A comparação de e-mail acontece dentro do banco e só o RESULTADO é gravado.
import type { Consulta, Transacao } from './comissao';
import { auditar } from './auditoria';
import { semControleTexto } from './texto';

export const antifraudeAtivo = (env: Record<string, string | undefined> = process.env): boolean => env.COLABORADORES_ATIVO === '1' && env.COLABORADORES_ANTIFRAUDE === '1';

/** Limiares (constantes do código; qualquer ajuste é uma decisão do fundador e passa por PR). */
export const LIMIARES = {
  compras_do_mesmo_pagador_30d: 3,          // a partir da 3ª compra do MESMO pagador para o mesmo colaborador em 30 dias
  contas_novas_7d: 5,                        // 5 ou mais ocorrências com o código, em 7 dias, de contas com menos de 24 h de vida
  ocorrencias_24h: 20,                       // 20 ou mais ocorrências com o código em 24 h
} as const;

export type TipoDeSinal = 'pagador_igual_colaborador' | 'pagador_repetido' | 'contas_novas_com_codigo' | 'pico_de_ocorrencias';

/** Normaliza e-mail para COMPARAR (minúsculas; sem `+etiqueta`; sem pontos no começo do endereço do Gmail). Nunca é gravado. */
export function emailNormalizado(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const t = email.trim().toLowerCase(); const at = t.lastIndexOf('@');
  if (at < 1 || at === t.length - 1) return null;
  let local = t.slice(0, at); let dominio = t.slice(at + 1);
  local = local.split('+')[0];
  if (dominio === 'googlemail.com') dominio = 'gmail.com';
  if (dominio === 'gmail.com') local = local.replace(/\./g, '');
  return local ? `${local}@${dominio}` : null;
}

async function gravarSinal(tx: Transacao, s: { colaboradorId: string; tipo: TipoDeSinal; pagamentoRef?: string | null; bloqueia: boolean; detalhe: Record<string, unknown>; chave: string }): Promise<boolean> {
  const r = await tx.query(
    `INSERT INTO colaborador_sinais (colaborador_id, tipo, pagamento_ref, bloqueia, detalhe, chave) VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (chave) DO NOTHING RETURNING id`,
    [s.colaboradorId, s.tipo, s.pagamentoRef ?? null, s.bloqueia, JSON.stringify(s.detalhe), s.chave],
  );
  return r.rows.length > 0;
}

/** Sinais de UMA COMPRA (retêm a comissão até a decisão do admin): pagador com o mesmo e-mail do colaborador e pagador repetido. */
export async function avaliarCompra(tx: Transacao, e: { colaboradorId: string; pagamentoRef: string; compradorId: string }): Promise<TipoDeSinal[]> {
  const novos: TipoDeSinal[] = [];
  const igual = await tx.query(
    `SELECT lower(btrim(cu.email)) AS a, lower(btrim(pu.email)) AS b FROM colaboradores c JOIN users cu ON cu.id = c.user_id JOIN users pu ON pu.id = $2 WHERE c.id = $1`,
    [e.colaboradorId, e.compradorId],
  );
  const a = emailNormalizado(igual.rows[0]?.a); const b = emailNormalizado(igual.rows[0]?.b);
  if (a && b && a === b && await gravarSinal(tx, { colaboradorId: e.colaboradorId, tipo: 'pagador_igual_colaborador', pagamentoRef: e.pagamentoRef, bloqueia: true, detalhe: { comparacao: 'email_normalizado_igual' }, chave: `pagador_igual:${e.pagamentoRef}` })) novos.push('pagador_igual_colaborador');

  const rep = await tx.query(
    `SELECT COUNT(*)::int AS n FROM colaborador_lancamentos l JOIN boosts b ON b.id = l.boost_id
      WHERE l.colaborador_id = $1 AND l.tipo = 'comissao' AND b.user_id = $2 AND l.criado_em >= now() - interval '30 days'`,
    [e.colaboradorId, e.compradorId],
  );
  const n = Number(rep.rows[0]?.n ?? 0);
  if (n >= LIMIARES.compras_do_mesmo_pagador_30d && await gravarSinal(tx, { colaboradorId: e.colaboradorId, tipo: 'pagador_repetido', pagamentoRef: e.pagamentoRef, bloqueia: true, detalhe: { compras_30d: n, limiar: LIMIARES.compras_do_mesmo_pagador_30d }, chave: `pagador_repetido:${e.pagamentoRef}` })) novos.push('pagador_repetido');
  return novos;
}

/** Sinais do COLABORADOR (só avisam): contas recém-criadas usando o código e pico de ocorrências. Idempotente por semana/dia. */
export async function avaliarColaborador(tx: Transacao, colaboradorId: string, agora: Date = new Date()): Promise<TipoDeSinal[]> {
  const novos: TipoDeSinal[] = [];
  const iso = agora.toISOString(); const dia = iso.slice(0, 10);
  const semana = `${agora.getUTCFullYear()}-W${String(Math.floor((Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()) - Date.UTC(agora.getUTCFullYear(), 0, 1)) / 604_800_000)).padStart(2, '0')}`;
  const novas = await tx.query(
    `SELECT COUNT(*)::int AS n FROM objects o JOIN users u ON u.id = o.user_id
      WHERE o.colaborador_id = $1 AND o.created_at >= $2::timestamptz - interval '7 days' AND u.created_at > o.created_at - interval '24 hours'`, [colaboradorId, iso]);
  const n = Number(novas.rows[0]?.n ?? 0);
  if (n >= LIMIARES.contas_novas_7d && await gravarSinal(tx, { colaboradorId, tipo: 'contas_novas_com_codigo', bloqueia: false, detalhe: { ocorrencias_de_contas_novas_7d: n, limiar: LIMIARES.contas_novas_7d }, chave: `contas_novas:${colaboradorId}:${semana}` })) novos.push('contas_novas_com_codigo');
  const pico = await tx.query(`SELECT COUNT(*)::int AS n FROM objects WHERE colaborador_id = $1 AND created_at >= $2::timestamptz - interval '24 hours'`, [colaboradorId, iso]);
  const p = Number(pico.rows[0]?.n ?? 0);
  if (p >= LIMIARES.ocorrencias_24h && await gravarSinal(tx, { colaboradorId, tipo: 'pico_de_ocorrencias', bloqueia: false, detalhe: { ocorrencias_24h: p, limiar: LIMIARES.ocorrencias_24h }, chave: `pico:${colaboradorId}:${dia}` })) novos.push('pico_de_ocorrencias');
  return novos;
}

export async function listarSinais(consulta: Consulta, estado = 'aberto') {
  const r = await consulta(
    `SELECT s.id, s.tipo, s.pagamento_ref, s.bloqueia, s.detalhe, s.estado, s.criado_em, s.decidido_em, s.motivo, c.slug, c.nome
       FROM colaborador_sinais s JOIN colaboradores c ON c.id = s.colaborador_id WHERE s.estado = $1 ORDER BY s.criado_em ASC LIMIT 200`, [estado]);
  return r.rows;
}

/** Decisão do admin: DESCARTAR (libera a comissão retida) ou CONFIRMAR (mantém retida; correções de valor só por ajuste no livro). Motivo obrigatório; auditada. */
export async function decidirSinal(tx: Transacao, sinalId: string, decisao: 'descartar' | 'confirmar', adminId: string, motivoBruto: unknown):
  Promise<{ ok: true } | { ok: false; erro: 'NAO_ENCONTRADO' | 'JA_DECIDIDO' | 'MOTIVO_OBRIGATORIO' }> {
  const motivo = typeof motivoBruto === 'string' ? semControleTexto(motivoBruto).slice(0, 500) : '';
  if (motivo.length < 3) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
  await tx.query('BEGIN');
  try {
    const s = await tx.query(`SELECT id, colaborador_id, tipo, estado FROM colaborador_sinais WHERE id = $1 FOR UPDATE`, [sinalId]);
    if (s.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    if (s.rows[0].estado !== 'aberto') { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_DECIDIDO' }; }
    const novo = decisao === 'descartar' ? 'descartado' : 'confirmado';
    await tx.query(`UPDATE colaborador_sinais SET estado = $2, decidido_em = now(), decidido_por = $3, motivo = $4 WHERE id = $1`, [sinalId, novo, adminId, motivo]);
    await auditar(tx, { ator: adminId, acao: `sinal_${novo}`, alvoTipo: 'sinal', alvoId: sinalId, antes: { estado: 'aberto' }, depois: { estado: novo, tipo: s.rows[0].tipo }, motivo });
    await tx.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}
