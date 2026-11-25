// Programa de Colaboradores (E7): ações do ADMIN sobre colaboradores, saques, ajustes e regras. SOMENTE SERVIDOR. Toda ação grava em `auditoria` (só INSERT).
// Nada é apagado: excluir muda `estado`; as ocorrências e o `colaborador_codigo` gravado nelas permanecem. Regras só valem daqui para frente.
import { saldoDoColaborador, type Consulta, type Transacao } from './comissao';
import { semControleTexto } from './texto';

export const adminAtivo = (env: Record<string, string | undefined> = process.env): boolean => env.COLABORADORES_ATIVO === '1';

export { auditar } from './auditoria';
import { auditar } from './auditoria';

export type AcaoDeEstado = 'suspender' | 'reativar' | 'excluir';
export type ResultadoEstado = { ok: true; estado: string; saldoCancelado?: number } | { ok: false; erro: 'NAO_ENCONTRADO' | 'INTERNO' | 'TRANSICAO_INVALIDA' | 'MOTIVO_OBRIGATORIO' };

const TRANSICOES: Record<AcaoDeEstado, { de: string[]; para: string; motivoObrigatorio: boolean }> = {
  suspender: { de: ['ativo'], para: 'suspenso', motivoObrigatorio: true },
  reativar: { de: ['suspenso', 'saiu'], para: 'ativo', motivoObrigatorio: false },
  excluir: { de: ['ativo', 'suspenso', 'saiu'], para: 'excluido', motivoObrigatorio: true },
};

/** Suspender, reativar ou EXCLUIR (por transgressão: POLÍTICA §6). Excluir cancela o saldo não pago se `exclusao_cancela_saldo` = sim (sujeito a parecer jurídico). */
export async function mudarEstado(tx: Transacao, colaboradorId: string, acao: AcaoDeEstado, adminId: string, motivoBruto: string | null): Promise<ResultadoEstado> {
  const t = TRANSICOES[acao]; const motivo = motivoBruto ? semControleTexto(motivoBruto).slice(0, 500) : null;
  if (t.motivoObrigatorio && !motivo) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
  await tx.query('BEGIN');
  try {
    const c = await tx.query(`SELECT id, estado, interno FROM colaboradores WHERE id = $1 FOR UPDATE`, [colaboradorId]);
    if (c.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    if (c.rows[0].interno === true) { await tx.query('ROLLBACK'); return { ok: false, erro: 'INTERNO' }; }
    const antes = String(c.rows[0].estado);
    if (!t.de.includes(antes)) { await tx.query('ROLLBACK'); return { ok: false, erro: 'TRANSICAO_INVALIDA' }; }
    let cancelado = 0;
    if (acao === 'excluir') {
      const cfg = await tx.query(`SELECT valor FROM programa_config WHERE chave = 'exclusao_cancela_saldo' AND vigente_desde <= now() ORDER BY vigente_desde DESC LIMIT 1`);
      if (String(cfg.rows[0]?.valor ?? 'sim') === 'sim') {
        // Pedido de saque aberto é recusado (o valor volta ao livro) e, em seguida, todo o saldo não pago é cancelado.
        const s = await tx.query(`SELECT id, valor_centavos FROM colaborador_saques WHERE colaborador_id = $1 AND estado = 'solicitado' FOR UPDATE`, [colaboradorId]);
        if (s.rows[0]) {
          await tx.query(`UPDATE colaborador_saques SET estado = 'recusado', decidido_em = now(), decidido_por = $2, motivo = 'exclusão do colaborador' WHERE id = $1`, [s.rows[0].id, adminId]);
          await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo, criado_por) VALUES ($1,'saque_cancelado',$2,$3,'exclusão do colaborador',$4)`,
            [colaboradorId, Number(s.rows[0].valor_centavos), `saque_cancelado:${s.rows[0].id}`, adminId]);
        }
        const saldo = await saldoDoColaborador((q, p) => tx.query(q, p), colaboradorId);
        if (saldo.totalCentavos > 0) {
          await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo, criado_por) VALUES ($1,'cancelamento_exclusao',$2,$3,$4,$5)`,
            [colaboradorId, -saldo.totalCentavos, `exclusao:${colaboradorId}`, motivo, adminId]);
          cancelado = saldo.totalCentavos;
        }
      }
    }
    await tx.query(`UPDATE colaboradores SET estado = $2, atualizado_em = now() WHERE id = $1`, [colaboradorId, t.para]);
    await auditar(tx, { ator: adminId, acao: `colaborador_${acao}`, alvoTipo: 'colaborador', alvoId: colaboradorId, antes: { estado: antes }, depois: { estado: t.para, saldoCanceladoCentavos: cancelado || undefined }, motivo });
    await tx.query('COMMIT');
    return { ok: true, estado: t.para, ...(cancelado ? { saldoCancelado: cancelado } : {}) };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

/** Ajuste do admin no livro (única forma de corrigir um lançamento): valor com sinal + motivo OBRIGATÓRIO. */
export async function ajusteDoAdmin(tx: Transacao, colaboradorId: string, valorCentavos: unknown, motivoBruto: unknown, adminId: string):
  Promise<{ ok: true } | { ok: false; erro: 'VALOR_INVALIDO' | 'MOTIVO_OBRIGATORIO' | 'NAO_ENCONTRADO' }> {
  const v = typeof valorCentavos === 'number' ? valorCentavos : NaN;
  if (!Number.isInteger(v) || v === 0 || Math.abs(v) > 100_000_00) return { ok: false, erro: 'VALOR_INVALIDO' };
  const motivo = typeof motivoBruto === 'string' ? semControleTexto(motivoBruto).slice(0, 500) : '';
  if (motivo.length < 5) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
  await tx.query('BEGIN');
  try {
    const c = await tx.query('SELECT id FROM colaboradores WHERE id = $1 FOR UPDATE', [colaboradorId]);
    if (c.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    const l = await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo, criado_por) VALUES ($1,'ajuste_admin',$2,$3,$4,$5) RETURNING id`,
      [colaboradorId, v, `ajuste:${colaboradorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, motivo, adminId]);
    await auditar(tx, { ator: adminId, acao: 'ajuste_admin', alvoTipo: 'colaborador', alvoId: colaboradorId, depois: { lancamentoId: l.rows[0].id, valorCentavos: v }, motivo });
    await tx.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

export type ResultadoSaqueAdmin = { ok: true } | { ok: false; erro: 'NAO_ENCONTRADO' | 'JA_DECIDIDO' | 'MOTIVO_OBRIGATORIO' };

/** O repasse por PIX é feito FORA do sistema; aqui o admin marca como PAGO (data e comprovante opcional). O livro NÃO muda (a reserva já foi o débito). */
export async function pagarSaque(tx: Transacao, saqueId: string, adminId: string, comprovante: unknown): Promise<ResultadoSaqueAdmin> {
  const comp = typeof comprovante === 'string' && comprovante.trim() ? semControleTexto(comprovante).slice(0, 300) : null;
  await tx.query('BEGIN');
  try {
    const s = await tx.query(`SELECT id, colaborador_id, valor_centavos, estado FROM colaborador_saques WHERE id = $1 FOR UPDATE`, [saqueId]);
    if (s.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    if (s.rows[0].estado !== 'solicitado') { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_DECIDIDO' }; }
    await tx.query(`UPDATE colaborador_saques SET estado = 'pago', decidido_em = now(), decidido_por = $2, comprovante = $3 WHERE id = $1`, [saqueId, adminId, comp]);
    await auditar(tx, { ator: adminId, acao: 'saque_pago', alvoTipo: 'saque', alvoId: saqueId, antes: { estado: 'solicitado' }, depois: { estado: 'pago', valorCentavos: Number(s.rows[0].valor_centavos), comprovante: comp ? 'informado' : null } });
    await tx.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

/** Recusar devolve o valor ao saldo (lançamento `saque_cancelado`); motivo obrigatório. */
export async function recusarSaque(tx: Transacao, saqueId: string, adminId: string, motivoBruto: unknown): Promise<ResultadoSaqueAdmin> {
  const motivo = typeof motivoBruto === 'string' ? semControleTexto(motivoBruto).slice(0, 500) : '';
  if (motivo.length < 3) return { ok: false, erro: 'MOTIVO_OBRIGATORIO' };
  await tx.query('BEGIN');
  try {
    const s = await tx.query(`SELECT id, colaborador_id, valor_centavos, estado FROM colaborador_saques WHERE id = $1 FOR UPDATE`, [saqueId]);
    if (s.rows.length === 0) { await tx.query('ROLLBACK'); return { ok: false, erro: 'NAO_ENCONTRADO' }; }
    if (s.rows[0].estado !== 'solicitado') { await tx.query('ROLLBACK'); return { ok: false, erro: 'JA_DECIDIDO' }; }
    await tx.query(`UPDATE colaborador_saques SET estado = 'recusado', decidido_em = now(), decidido_por = $2, motivo = $3 WHERE id = $1`, [saqueId, adminId, motivo]);
    await tx.query(`INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, chave_idempotencia, motivo, criado_por) VALUES ($1,'saque_cancelado',$2,$3,$4,$5)`,
      [s.rows[0].colaborador_id, Number(s.rows[0].valor_centavos), `saque_cancelado:${saqueId}`, motivo, adminId]);
    await auditar(tx, { ator: adminId, acao: 'saque_recusado', alvoTipo: 'saque', alvoId: saqueId, antes: { estado: 'solicitado' }, depois: { estado: 'recusado' }, motivo });
    await tx.query('COMMIT');
    return { ok: true };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw e;
  }
}

/** Fila de saques para o admin: dados de pagamento aparecem MASCARADOS (a chave inteira só é lida pelo script de repasse, fora desta tela). */
export async function listarSaquesAdmin(consulta: Consulta, estado = 'solicitado') {
  const r = await consulta(
    `SELECT s.id, s.valor_centavos, s.estado, s.solicitado_em, s.decidido_em, s.comprovante, s.motivo, c.slug, c.nome, (c.verificado_em IS NOT NULL) AS verificado,
            d.tipo_chave, d.chave_final, d.titular_nome, d.documento_final
       FROM colaborador_saques s JOIN colaboradores c ON c.id = s.colaborador_id LEFT JOIN colaborador_dados_pagamento d ON d.colaborador_id = c.id
      WHERE s.estado = $1 ORDER BY s.solicitado_em ASC LIMIT 200`, [estado]);
  return r.rows;
}

// ─── regras (programa_config) ────────────────────────────────────────────────────────────────────────────────────────
export const CHAVES_DE_REGRA = ['comissao_percentual', 'comissao_arredondamento', 'prazo_liberacao_dias', 'saque_minimo_centavos', 'prazo_saque_dias_uteis', 'exclusao_cancela_saldo'] as const;
export type ChaveDeRegra = typeof CHAVES_DE_REGRA[number];

export function validarRegra(chave: string, valor: unknown): { ok: true; valor: string } | { ok: false; erro: string } {
  const v = String(valor ?? '').trim();
  switch (chave as ChaveDeRegra) {
    case 'comissao_percentual': { const n = Number(v.replace(',', '.')); return n > 0 && n <= 100 && /^\d{1,3}([.,]\d{1,2})?$/.test(v) ? { ok: true, valor: String(n) } : { ok: false, erro: 'Percentual entre 0,01 e 100 (até 2 casas).' }; }
    case 'comissao_arredondamento': return ['baixo', 'cima', 'meio'].includes(v) ? { ok: true, valor: v } : { ok: false, erro: 'Use baixo, cima ou meio.' };
    case 'prazo_liberacao_dias': { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 365 && /^\d+$/.test(v) ? { ok: true, valor: String(n) } : { ok: false, erro: 'Dias inteiros de 0 a 365.' }; }
    case 'saque_minimo_centavos': { const n = Number(v); return Number.isInteger(n) && n >= 100 && n <= 1_000_000 && /^\d+$/.test(v) ? { ok: true, valor: String(n) } : { ok: false, erro: 'Centavos inteiros (mínimo R$ 1,00).' }; }
    case 'prazo_saque_dias_uteis': { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 30 && /^\d+$/.test(v) ? { ok: true, valor: String(n) } : { ok: false, erro: 'Dias úteis inteiros de 1 a 30.' }; }
    case 'exclusao_cancela_saldo': return v === 'sim' || v === 'nao' ? { ok: true, valor: v } : { ok: false, erro: 'Use sim ou nao.' };
    default: return { ok: false, erro: 'Regra desconhecida.' };
  }
}

export async function regrasVigentes(consulta: Consulta) {
  const r = await consulta(`SELECT DISTINCT ON (chave) chave, valor, vigente_desde, motivo FROM programa_config WHERE vigente_desde <= now() ORDER BY chave, vigente_desde DESC`);
  const futuras = await consulta(`SELECT chave, valor, vigente_desde FROM programa_config WHERE vigente_desde > now() ORDER BY vigente_desde ASC`);
  return { vigentes: r.rows, agendadas: futuras.rows };
}

/** Mudança de regra só vale DAQUI PARA FRENTE: nova linha com vigência de agora em diante (nunca no passado); a história fica. Motivo obrigatório; auditada. */
export async function definirRegra(tx: Transacao, chave: string, valor: unknown, vigenteDesde: unknown, motivoBruto: unknown, adminId: string, agora: Date = new Date()):
  Promise<{ ok: true; vigenteDesde: string } | { ok: false; erro: string }> {
  if (!(CHAVES_DE_REGRA as readonly string[]).includes(chave)) return { ok: false, erro: 'Regra desconhecida.' };
  const v = validarRegra(chave, valor); if (!v.ok) return v;
  const motivo = typeof motivoBruto === 'string' ? semControleTexto(motivoBruto).slice(0, 500) : ''; if (motivo.length < 5) return { ok: false, erro: 'Informe o motivo da mudança.' };
  let quando = agora;
  if (vigenteDesde !== undefined && vigenteDesde !== null && vigenteDesde !== '') {
    const d = new Date(String(vigenteDesde)); if (Number.isNaN(d.getTime())) return { ok: false, erro: 'Data de vigência inválida.' };
    if (d.getTime() < agora.getTime() - 60_000) return { ok: false, erro: 'A vigência não pode ficar no passado: a mudança só vale daqui para frente.' };
    quando = d.getTime() < agora.getTime() ? agora : d;
  }
  await tx.query('BEGIN');
  try {
    const antes = await tx.query(`SELECT valor FROM programa_config WHERE chave = $1 AND vigente_desde <= $2 ORDER BY vigente_desde DESC LIMIT 1`, [chave, quando.toISOString()]);
    await tx.query(`INSERT INTO programa_config (chave, valor, vigente_desde, criado_por, motivo) VALUES ($1,$2,$3,$4,$5)`, [chave, v.valor, quando.toISOString(), adminId, motivo]);
    await auditar(tx, { ator: adminId, acao: 'regra_alterada', alvoTipo: 'regra', alvoId: chave, antes: { valor: antes.rows[0]?.valor ?? null }, depois: { valor: v.valor, vigenteDesde: quando.toISOString() }, motivo });
    await tx.query('COMMIT');
    return { ok: true, vigenteDesde: quando.toISOString() };
  } catch (e) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    const code = (e as { code?: string })?.code; return code === '23505' ? { ok: false, erro: 'Já existe uma mudança desta regra com a mesma vigência.' } : (() => { throw e; })();
  }
}

// ─── lista, métricas e exportação ─────────────────────────────────────────────────────────────────────────────────────
export const mesValido = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const mesAtual = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Métricas por colaborador no mês (UTC): ocorrências com o código, compras de Boost nelas e comissão lançada; mais o saldo total do livro. Visitas: E8. */
export async function listaDeColaboradores(consulta: Consulta, mes: string) {
  const inicio = `${mes}-01T00:00:00Z`;
  const r = await consulta(
    `SELECT c.id, c.slug, c.nome, c.estado, c.interno, (c.verificado_em IS NOT NULL) AS verificado, c.canal_url, c.criado_em,
            (SELECT COUNT(*)::int FROM objects o WHERE o.colaborador_id = c.id AND o.created_at >= $1::timestamptz AND o.created_at < ($1::timestamptz + interval '1 month')) AS ocorrencias_no_mes,
            (SELECT COUNT(*)::int FROM boosts b JOIN objects o ON o.id = b.object_id WHERE o.colaborador_id = c.id AND b.provider = 'mercadopago' AND b.created_at >= $1::timestamptz AND b.created_at < ($1::timestamptz + interval '1 month')) AS compras_no_mes,
            (SELECT COALESCE(SUM(l.valor_centavos), 0)::int FROM colaborador_lancamentos l WHERE l.colaborador_id = c.id AND l.tipo = 'comissao' AND l.criado_em >= $1::timestamptz AND l.criado_em < ($1::timestamptz + interval '1 month')) AS comissao_no_mes_centavos,
            (SELECT COALESCE(SUM(l.valor_centavos), 0)::int FROM colaborador_lancamentos l WHERE l.colaborador_id = c.id) AS saldo_total_centavos
       FROM colaboradores c ORDER BY c.criado_em ASC LIMIT 1000`, [inicio]);
  return r.rows;
}

/** CSV seguro: texto de terceiros (nome, link) nunca vira fórmula de planilha (prefixo ' em =, +, -, @) e vai entre aspas. */
export function celulaCsv(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}
export function csvDaLista(mes: string, linhas: Array<Record<string, unknown>>): string {
  const cab = ['mes', 'slug', 'nome', 'estado', 'verificado', 'visitas_no_mes', 'ocorrencias_no_mes', 'compras_no_mes', 'comissao_no_mes_centavos', 'saldo_total_centavos'];
  return [cab.join(','), ...linhas.map((l) => [mes, l.slug, l.nome, l.estado, l.verificado ? 'sim' : 'nao', l.visitas_no_mes ?? '', l.ocorrencias_no_mes, l.compras_no_mes, l.comissao_no_mes_centavos, l.saldo_total_centavos].map(celulaCsv).join(','))].join('\r\n') + '\r\n';
}
