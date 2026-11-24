// Programa de Colaboradores (E1): leitura e validação do código do colaborador. SOMENTE SERVIDOR (usa o banco).
// O código vale para QUALQUER ocorrência, é opcional, e é decidido no servidor: o navegador só sugere o texto.
// Formas aceitas: `@nome` (com ou sem `@`) ou o código curto (ex.: ZL27), em qualquer caixa. Código inválido OU de colaborador inativo = a mesma resposta.

/** Valor do campo `error` quando o código não é aceito (o cadastro NÃO é criado). */
export const CODIGO_COLABORADOR_INVALIDO = 'CODIGO_COLABORADOR_INVALIDO';
export const MENSAGEM_CODIGO_INVALIDO = 'Código do colaborador inválido ou inativo. Confira o código ou apague o campo para registrar sem ele.';

export interface ColaboradorResolvido {
  id: string;
  slug: string;
  codigoCurto: string;
  nome: string;
  /** Texto do código como foi aceito, gravado na ocorrência (o que a pessoa usou: `@slug` ou o código curto). */
  codigoRegistrado: string;
}

export interface CodigoNormalizado {
  /** Texto começou com `@`: só vale como @nome. */
  soSlug: boolean;
  slug: string;   // minúsculas
  curto: string;  // maiúsculas
}

/** Aceita só letras sem acento, números e hífen (com `@` opcional na frente), de 2 a 30 caracteres. Qualquer outra coisa = null. */
export function normalizarCodigo(texto: unknown): CodigoNormalizado | null {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  const soSlug = t.startsWith('@');
  const corpo = soSlug ? t.slice(1) : t;
  if (!/^[A-Za-z0-9-]{2,30}$/.test(corpo)) return null;
  return { soSlug, slug: corpo.toLowerCase(), curto: corpo.toUpperCase() };
}

type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

/**
 * Procura um colaborador ATIVO pelo texto. Sem `@`, o código curto tem preferência sobre um @nome igual (um slug de 4 caracteres pode coincidir com um
 * código curto de outro colaborador); com `@`, só vale o @nome. Devolve null para inexistente, inativo (suspenso, excluído, saiu) ou texto malformado.
 */
export async function resolverColaborador(consulta: Consulta, texto: unknown): Promise<ColaboradorResolvido | null> {
  const n = normalizarCodigo(texto);
  if (!n) return null;
  const r = await consulta(
    `SELECT id, slug, codigo_curto, nome FROM colaboradores
      WHERE estado = 'ativo' AND (lower(slug) = $1 OR ($3::boolean = false AND upper(codigo_curto) = $2))`,
    [n.slug, n.curto, n.soSlug],
  );
  if (r.rows.length === 0) return null;
  const porCodigo = n.soSlug ? undefined : r.rows.find((x) => String(x.codigo_curto).toUpperCase() === n.curto);
  const achado = porCodigo ?? r.rows.find((x) => String(x.slug).toLowerCase() === n.slug);
  if (!achado) return null;
  const slug = String(achado.slug);
  const codigoCurto = String(achado.codigo_curto);
  return {
    id: String(achado.id), slug, codigoCurto, nome: String(achado.nome),
    codigoRegistrado: porCodigo ? codigoCurto : `@${slug}`,
  };
}
