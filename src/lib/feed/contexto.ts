// «Informar que encontrei»: o botão do card leva ao /achei com o código do card (?de=<código>), e o /achei mostra de qual ocorrência a pessoa está falando.
// Lógica PURA (sem React, sem rede), testável sem navegador. O código do card já é público (está no link /objeto/<código>); aqui ele só serve para
// pedir à API de contexto o título (mascarado), a categoria e a situação de um PERDIDO de USUÁRIO elegível ao Feed. Para qualquer outro valor: nada.
import { FEED_CATEGORY_LABELS, isFeedCategoryKey, type FeedCategoryKey } from './category';

export const DE_MAX = 64;
/** Formato aceito do código: letras, números, «-» e «_» (os códigos de usuário têm 8 caracteres). Qualquer outra coisa é ignorada em silêncio. */
const DE_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** Código válido para consulta, ou null (vazio, malformado, longo demais, com marcação, repetido ou lista). */
export function lerDe(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null;
  const v = valor.trim();
  return v.length <= DE_MAX && DE_RE.test(v) ? v : null;
}

/** Lê o parâmetro «de» de uma query string (ex.: window.location.search). Se vier mais de um «de», ignora (ambíguo). */
export function lerDeDaUrl(search: string | null | undefined): string | null {
  try {
    const todos = new URLSearchParams(search ?? '').getAll('de');
    return todos.length === 1 ? lerDe(todos[0]) : null;
  } catch { return null; }
}

/** Destino do botão «Informar que encontrei» do card (código com encoding correto). */
export const acheiHref = (code: string) => `/achei?ref=feed&de=${encodeURIComponent(code)}`;

export interface ContextoAchei { titulo: string; categoria: FeedCategoryKey; categoria_rotulo: string; situacao: 'lost' }

/** Aceita só o formato exato que a API devolve; qualquer outra coisa vira null (a página fica como hoje). */
export function validarContexto(v: unknown): ContextoAchei | null {
  if (!v || typeof v !== 'object') return null;
  const c = (v as { contexto?: unknown }).contexto;
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  if (typeof o.titulo !== 'string' || !o.titulo.trim() || o.titulo.length > 300) return null;
  if (typeof o.categoria !== 'string' || !isFeedCategoryKey(o.categoria)) return null;
  if (o.situacao !== 'lost') return null;
  return { titulo: o.titulo, categoria: o.categoria, categoria_rotulo: FEED_CATEGORY_LABELS[o.categoria], situacao: 'lost' };
}

const PALAVRAS_DE_SITUACAO = /^(perdid[oa]s?|achad[oa]s?|roubad[oa]s?)$/i;
/** Palavras do título para pré-preencher a busca: sem a marca da máscara, sem «em nome de» e sem a palavra de situação; no máximo 6 palavras e 60 caracteres. */
export function palavrasDoTitulo(titulo: string): string {
  const limpo = titulo.replace(/\(nome omitido\)/gi, ' ').replace(/\bem nome de\b/gi, ' ').replace(/[^\p{L}\p{N}\s'-]/gu, ' ');
  const palavras = limpo.split(/\s+/).filter((p) => p && !PALAVRAS_DE_SITUACAO.test(p)).slice(0, 6);
  return palavras.join(' ').slice(0, 60).trim();
}

/** Destino do cadastro: o que o cadastro já aceita (intent=found, prefill_title, prefill_category), com encoding correto. Sem contexto: o link de sempre. */
export function cadastroHref(ctx: Pick<ContextoAchei, 'titulo' | 'categoria'> | null): string {
  if (!ctx) return '/auth/register?intent=found';
  const q = new URLSearchParams({ intent: 'found', prefill_title: ctx.titulo.slice(0, 120), prefill_category: ctx.categoria });
  return `/auth/register?${q.toString()}`;
}
