// Trilha de auditoria do programa (só INSERT na tabela `auditoria`). Módulo próprio para evitar importação circular com o livro e com o admin.
import type { Transacao } from './comissao';

export async function auditar(tx: Transacao, a: { ator: string; acao: string; alvoTipo: string; alvoId: string; antes?: unknown; depois?: unknown; motivo?: string | null }) {
  await tx.query(`INSERT INTO auditoria (ator_id, acao, alvo_tipo, alvo_id, antes, depois, motivo) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
    [a.ator, a.acao, a.alvoTipo, a.alvoId, a.antes === undefined ? null : JSON.stringify(a.antes), a.depois === undefined ? null : JSON.stringify(a.depois), a.motivo ?? null]);
}
