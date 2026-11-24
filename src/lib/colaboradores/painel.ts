// Programa de Colaboradores (E6): dados do painel do colaborador. SOMENTE SERVIDOR.
// O colaborador vê APENAS as ocorrências cadastradas pelo seu link, como já aparecem publicamente: código, título (nomes de pessoas mascarados), tipo, categoria e data.
// NUNCA vê nome, e-mail, telefone, local exato nem identificador de quem cadastrou (POLÍTICA §7).
import { maskPersonNames } from '@/lib/privacy/maskPersonNames';
import { feedCategoryKey, FEED_CATEGORY_LABELS } from '@/lib/feed/category';
import { STATUS_LABELS } from '@/lib/feed/time';
import { saldoDoColaborador, type Consulta, type Saldo } from './comissao';
import { lerDadosPagamento, listarSaques, saldoVisivel, saqueAtivo, saqueMinimoCentavos, type DadosPagamentoMascarados } from './saque';

export interface OcorrenciaDoColaborador { code: string; title: string; status_label: string; category_label: string; created_at: string; visivel_no_feed: boolean }

/** Campos FIXOS: nada além disto sai daqui (os testes conferem a lista). */
export const CAMPOS_DA_OCORRENCIA = ['code', 'title', 'status_label', 'category_label', 'created_at', 'visivel_no_feed'] as const;

export async function ocorrenciasDoColaborador(consulta: Consulta, colaboradorId: string, limite = 50): Promise<OcorrenciaDoColaborador[]> {
  const r = await consulta(
    `SELECT qr_code, title, status, category, type, created_at, (is_public IS NOT FALSE AND COALESCE(is_legacy, false) = false AND status IN ('lost','found','stolen')) AS visivel
       FROM objects WHERE colaborador_id = $1 AND status <> 'deleted' ORDER BY created_at DESC LIMIT $2`,
    [colaboradorId, Math.min(Math.max(limite, 1), 100)],
  );
  return r.rows.map((x) => {
    const cat = feedCategoryKey((x.category ?? x.type) as string | null);
    return {
      code: String(x.qr_code), title: maskPersonNames(String(x.title ?? '')) || 'Ocorrência sem título',
      status_label: (STATUS_LABELS as Record<string, string>)[String(x.status)] ?? ({ archived: 'Arquivada', returned: 'Devolvida', protected: 'Protegido' } as Record<string, string>)[String(x.status)] ?? 'Outra situação', category_label: FEED_CATEGORY_LABELS[cat],
      created_at: new Date(x.created_at as string).toISOString(), visivel_no_feed: x.visivel === true,
    };
  });
}

export interface PainelDoColaborador {
  ocorrencias: OcorrenciaDoColaborador[];
  /** Só com COLABORADORES_SALDO=1; senão `null` e a tela mostra «Comissão em apuração». */
  saldo: Saldo | null;
  saque: { ativo: boolean; minimoCentavos: number; prazoDiasUteis: number; dadosPagamento: DadosPagamentoMascarados | null; pedidos: Array<Record<string, unknown>> } | null;
}

export async function painelDoColaborador(consulta: Consulta, colaboradorId: string, env: Record<string, string | undefined> = process.env): Promise<PainelDoColaborador> {
  const ocorrencias = await ocorrenciasDoColaborador(consulta, colaboradorId);
  const saldo = saldoVisivel(env) ? await saldoDoColaborador(consulta, colaboradorId) : null;
  const saque = saqueAtivo(env)
    ? { ativo: true, minimoCentavos: await saqueMinimoCentavos(consulta), prazoDiasUteis: 10, dadosPagamento: await lerDadosPagamento(consulta, colaboradorId), pedidos: await listarSaques(consulta, colaboradorId) }
    : null;
  return { ocorrencias, saldo, saque };
}
