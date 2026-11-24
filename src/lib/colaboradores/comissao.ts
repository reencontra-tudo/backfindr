// Programa de Colaboradores (E4): comissão em MODO SOMBRA. SOMENTE SERVIDOR. Calcula e grava no livro (`colaborador_lancamentos`); NADA é mostrado a colaborador algum.
// INTERRUPTOR: `COMISSAO_SOMBRA=1` (além de `COLABORADORES_ATIVO=1`). Ausente = DESLIGADO: nada é lido nem gravado, e o webhook funciona como antes.
// ISOLAMENTO: esta camada roda DEPOIS do boost/plano ativados; qualquer erro aqui é registrado no log e NUNCA muda a resposta nem o boost (DESENHO §3.1.5).
// Regras (decisões do fundador, 24/11/2026): comissão = percentual (25 %) do valor BRUTO pago, centavo arredondado PARA BAIXO, percentual lido de `programa_config` na hora da
// compra e copiado para o lançamento; só Boost (N1); não gera para colaborador inativo, interno, compra de teste, compra do próprio colaborador, nem dono da ocorrência = colaborador;
// só pagamento aprovado; estorno/cancelamento/contestação = lançamento negativo (o Boost continua ativo, #4); a comissão só conta como DISPONÍVEL depois do prazo (14 dias)
// e com o canal VERIFICADO.
export const comissaoSombraAtiva = (env: Record<string, string | undefined> = process.env): boolean => env.COLABORADORES_ATIVO === '1' && env.COMISSAO_SOMBRA === '1';

export type Arredondamento = 'baixo' | 'cima' | 'meio';
export const PADRAO = { percentual: 25, arredondamento: 'baixo' as Arredondamento, prazoLiberacaoDias: 14 };

/** R$ → centavos inteiros (sem erro de ponto flutuante: 24.9 → 2490, 9.9 → 990). */
export function centavosDoValor(valor: unknown): number {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Percentual da base, em centavos inteiros. Base e percentual inválidos (ou fora de 0–100) = 0. */
export function comissaoEmCentavos(baseCentavos: number, percentual: number, modo: Arredondamento = 'baixo'): number {
  if (!Number.isInteger(baseCentavos) || baseCentavos <= 0 || !Number.isFinite(percentual) || percentual <= 0 || percentual > 100) return 0;
  const bruto = (baseCentavos * Math.round(percentual * 100)) / 10000; // percentual com 2 casas, sem flutuante
  return modo === 'cima' ? Math.ceil(bruto - 1e-9) : modo === 'meio' ? Math.floor(bruto + 0.5 + 1e-9) : Math.floor(bruto + 1e-9);
}

export type MotivoSemComissao = 'valor_invalido' | 'sem_colaborador' | 'colaborador_inativo' | 'interno' | 'compra_de_teste' | 'autocompra' | 'dono_e_colaborador' | 'nao_aprovado';
export interface ContextoElegibilidade {
  statusPagamento: string;
  valorCentavos: number;
  provedorDoBoost: string | null;
  compradorId: string | null;       // boosts.user_id
  donoDaOcorrenciaId: string | null; // objects.user_id
  colaborador: { id: string; estado: string; interno: boolean; userId: string | null } | null;
}
export function elegibilidade(c: ContextoElegibilidade): { gera: true } | { gera: false; motivo: MotivoSemComissao } {
  if (c.statusPagamento !== 'approved') return { gera: false, motivo: 'nao_aprovado' };
  if (!(c.valorCentavos > 0)) return { gera: false, motivo: 'valor_invalido' };
  if (!c.colaborador) return { gera: false, motivo: 'sem_colaborador' };
  if (c.colaborador.interno) return { gera: false, motivo: 'interno' };
  if (c.colaborador.estado !== 'ativo') return { gera: false, motivo: 'colaborador_inativo' };
  if (c.provedorDoBoost === 'test') return { gera: false, motivo: 'compra_de_teste' };
  const u = c.colaborador.userId;
  if (u && c.compradorId && u === c.compradorId) return { gera: false, motivo: 'autocompra' };
  if (u && c.donoDaOcorrenciaId && u === c.donoDaOcorrenciaId) return { gera: false, motivo: 'dono_e_colaborador' };
  return { gera: true };
}

// ─── banco ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Linha = Record<string, unknown>;
export type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Linha[]; rowCount?: number | null }>;
export interface Transacao { query: Consulta }

export interface ConfigVigente { percentual: number; arredondamento: Arredondamento; prazoLiberacaoDias: number }

/** Regras vigentes em `quando` (mudança só vale daqui para frente). Sem a tabela de configuração, usa os padrões do fundador. */
export async function configVigente(consulta: Consulta, quando: Date = new Date()): Promise<ConfigVigente> {
  const r = await consulta(
    `SELECT DISTINCT ON (chave) chave, valor FROM programa_config WHERE vigente_desde <= $1 AND chave IN ('comissao_percentual','comissao_arredondamento','prazo_liberacao_dias') ORDER BY chave, vigente_desde DESC`,
    [quando.toISOString()],
  );
  const m = new Map(r.rows.map((x) => [String(x.chave), String(x.valor)]));
  const pct = Number(m.get('comissao_percentual')); const dias = Number(m.get('prazo_liberacao_dias')); const arr = m.get('comissao_arredondamento');
  return {
    percentual: Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : PADRAO.percentual,
    arredondamento: arr === 'cima' || arr === 'meio' || arr === 'baixo' ? arr : PADRAO.arredondamento,
    prazoLiberacaoDias: Number.isInteger(dias) && dias >= 0 && dias <= 365 ? dias : PADRAO.prazoLiberacaoDias,
  };
}

export interface EntradaPagamento {
  paymentId: string;
  status: string;
  /** `transaction_amount` do Mercado Pago (valor BRUTO pago). */
  valorBruto: number;
  /** `transaction_amount_refunded`, quando houver. */
  valorReembolsado?: number;
}

export type ResultadoSombra =
  | { resultado: 'lancado'; lancamentoId: string; valorCentavos: number }
  | { resultado: 'ja_lancado' }
  | { resultado: 'sem_comissao'; motivo: MotivoSemComissao | 'boost_nao_encontrado' };

async function registrarEvento(tx: Transacao, e: EntradaPagamento, resumo: Record<string, unknown>) {
  await tx.query(
    `INSERT INTO pagamento_eventos (provider, pagamento_id, status, resumo) VALUES ('mercadopago', $1, $2, $3::jsonb)
     ON CONFLICT (provider, pagamento_id, status) DO UPDATE SET tentativas = pagamento_eventos.tentativas + 1, resumo = EXCLUDED.resumo`,
    [e.paymentId, e.status.slice(0, 40), JSON.stringify(resumo)],
  );
}

/** Pagamento APROVADO de Boost → lançamento de comissão (uma vez por pagamento). Chame DEPOIS de o boost estar gravado. Transação própria (BEGIN/COMMIT aqui). */
export async function registrarComissaoSombra(tx: Transacao, e: EntradaPagamento, agora: Date = new Date()): Promise<ResultadoSombra> {
  await tx.query('BEGIN');
  try {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mpc:${e.paymentId}`]);
    const valorCentavos = centavosDoValor(e.valorBruto);
    const b = await tx.query(`SELECT id, user_id, object_id, provider FROM boosts WHERE provider = 'mercadopago' AND provider_ref = $1 LIMIT 1`, [e.paymentId]);
    const boost = b.rows[0];
    if (!boost) { await registrarEvento(tx, e, { valorCentavos, semComissao: 'boost_nao_encontrado' }); await tx.query('COMMIT'); return { resultado: 'sem_comissao', motivo: 'boost_nao_encontrado' }; }
    const o = await tx.query(`SELECT user_id, colaborador_id FROM objects WHERE id = $1`, [boost.object_id]);
    const obj = o.rows[0];
    let colaborador: ContextoElegibilidade['colaborador'] = null;
    if (obj?.colaborador_id) {
      const c = await tx.query(`SELECT id, estado, interno, user_id FROM colaboradores WHERE id = $1`, [obj.colaborador_id]);
      if (c.rows[0]) colaborador = { id: String(c.rows[0].id), estado: String(c.rows[0].estado), interno: c.rows[0].interno === true, userId: c.rows[0].user_id ? String(c.rows[0].user_id) : null };
    }
    const el = elegibilidade({ statusPagamento: e.status, valorCentavos, provedorDoBoost: (boost.provider as string | null) ?? null, compradorId: String(boost.user_id), donoDaOcorrenciaId: obj?.user_id ? String(obj.user_id) : null, colaborador });
    if (!el.gera) { await registrarEvento(tx, e, { valorCentavos, semComissao: el.motivo }); await tx.query('COMMIT'); return { resultado: 'sem_comissao', motivo: el.motivo }; }

    const cfg = await configVigente((t, p) => tx.query(t, p), agora);
    const comissao = comissaoEmCentavos(valorCentavos, cfg.percentual, cfg.arredondamento);
    if (comissao <= 0) { await registrarEvento(tx, e, { valorCentavos, semComissao: 'valor_invalido' }); await tx.query('COMMIT'); return { resultado: 'sem_comissao', motivo: 'valor_invalido' }; }
    const disponivelEm = new Date(agora.getTime() + cfg.prazoLiberacaoDias * 86_400_000).toISOString();
    const ins = await tx.query(
      `INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, boost_id, objeto_id, pagamento_ref, percentual_aplicado, base_centavos, disponivel_em, chave_idempotencia)
       VALUES ($1, 'comissao', $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (chave_idempotencia) DO NOTHING RETURNING id`,
      [colaborador!.id, comissao, boost.id, boost.object_id, e.paymentId, cfg.percentual, valorCentavos, disponivelEm, `comissao:${e.paymentId}`],
    );
    await registrarEvento(tx, e, { valorCentavos, comissaoCentavos: comissao, percentual: cfg.percentual });
    await tx.query('COMMIT');
    return ins.rows[0] ? { resultado: 'lancado', lancamentoId: String(ins.rows[0].id), valorCentavos: comissao } : { resultado: 'ja_lancado' };
  } catch (err) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw err;
  }
}

/**
 * Estorno, cancelamento ou contestação → lançamento NEGATIVO da comissão do pagamento (idempotente e cumulativo para estornos parciais: nunca estorna mais do que foi creditado).
 * O Boost não muda. Se o crédito já foi sacado, o saldo pode ficar negativo e o próximo saque desconta (DESENHO §3.6).
 */
export async function registrarEstornoSombra(tx: Transacao, e: EntradaPagamento): Promise<{ resultado: 'estornado'; valorCentavos: number } | { resultado: 'nada_a_fazer'; motivo: 'sem_comissao_do_pagamento' | 'ja_estornado' }> {
  await tx.query('BEGIN');
  try {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mpc:${e.paymentId}`]);
    const c = await tx.query(`SELECT id, colaborador_id, valor_centavos, boost_id, objeto_id, base_centavos FROM colaborador_lancamentos WHERE pagamento_ref = $1 AND tipo = 'comissao' LIMIT 1`, [e.paymentId]);
    const original = c.rows[0];
    await registrarEvento(tx, e, { valorBrutoCentavos: centavosDoValor(e.valorBruto), valorReembolsadoCentavos: centavosDoValor(e.valorReembolsado ?? 0) });
    if (!original) { await tx.query('COMMIT'); return { resultado: 'nada_a_fazer', motivo: 'sem_comissao_do_pagamento' }; }
    const credito = Number(original.valor_centavos); const base = Number(original.base_centavos) || centavosDoValor(e.valorBruto);
    const reembolsado = centavosDoValor(e.valorReembolsado ?? 0);
    // Cancelado ou contestado: crédito inteiro. Reembolso PARCIAL (o Mercado Pago mantém o status `approved` com `transaction_amount_refunded` > 0): proporcional ao que foi devolvido.
    // Reembolso total (`refunded`) ou valor devolvido que cobre o pago: crédito inteiro.
    const parcial = e.status !== 'cancelled' && e.status !== 'charged_back' && reembolsado > 0 && base > 0 && reembolsado < base;
    const total = parcial ? Math.floor((credito * reembolsado) / base) : credito;
    const ja = await tx.query(`SELECT COALESCE(SUM(-valor_centavos), 0)::int AS n FROM colaborador_lancamentos WHERE pagamento_ref = $1 AND tipo = 'estorno'`, [e.paymentId]);
    const faltam = Math.min(total, credito) - Number(ja.rows[0].n);
    if (faltam <= 0) { await tx.query('COMMIT'); return { resultado: 'nada_a_fazer', motivo: 'ja_estornado' }; }
    await tx.query(
      `INSERT INTO colaborador_lancamentos (colaborador_id, tipo, valor_centavos, boost_id, objeto_id, pagamento_ref, base_centavos, chave_idempotencia, motivo)
       VALUES ($1, 'estorno', $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (chave_idempotencia) DO NOTHING`,
      [original.colaborador_id, -faltam, original.boost_id, original.objeto_id, e.paymentId, base, `estorno:${e.paymentId}:${Math.min(total, credito)}`, `pagamento ${e.status}`],
    );
    await tx.query('COMMIT');
    return { resultado: 'estornado', valorCentavos: faltam };
  } catch (err) {
    try { await tx.query('ROLLBACK'); } catch { /* já encerrada */ }
    throw err;
  }
}

export interface Saldo { pendenteCentavos: number; disponivelCentavos: number; totalCentavos: number }

/**
 * Saldo = SOMA do livro (nunca um campo). Disponível: comissões cujo prazo passou, com o canal VERIFICADO e fora de análise, mais todos os lançamentos negativos/ajustes
 * (descontos valem na hora). Pendente: o que ainda não pode ser sacado (prazo não venceu, canal não verificado ou em análise).
 */
export async function saldoDoColaborador(consulta: Consulta, colaboradorId: string, agora: Date = new Date()): Promise<Saldo> {
  const r = await consulta(
    `SELECT
       COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo = 'comissao' AND (l.disponivel_em IS NULL OR l.disponivel_em <= $2) AND c.verificado_em IS NOT NULL AND NOT l.em_analise), 0)::int AS liberada,
       COALESCE(SUM(l.valor_centavos) FILTER (WHERE l.tipo <> 'comissao'), 0)::int AS outros,
       COALESCE(SUM(l.valor_centavos), 0)::int AS total
       FROM colaborador_lancamentos l JOIN colaboradores c ON c.id = l.colaborador_id WHERE l.colaborador_id = $1`,
    [colaboradorId, agora.toISOString()],
  );
  const x = r.rows[0] ?? {}; const liberada = Number(x.liberada ?? 0); const outros = Number(x.outros ?? 0); const total = Number(x.total ?? 0);
  const disponivel = liberada + outros;
  return { disponivelCentavos: disponivel, pendenteCentavos: total - disponivel, totalCentavos: total };
}
