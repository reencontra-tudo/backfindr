// Programa de Colaboradores (E2): dados e regras da página pública `/@nome`. SOMENTE SERVIDOR (usa o banco por meio da função de consulta recebida).

export type EstadoColaborador = 'ativo' | 'suspenso' | 'excluido' | 'saiu';

export interface ColaboradorPagina {
  id: string;
  slug: string;
  codigoCurto: string;
  nome: string;
  descricao: string | null;
  imagemUrl: string | null;
  canalUrl: string | null;
  regiaoCidade: string | null;
  regiaoUf: string | null;
  regiaoLat: number | null;
  regiaoLng: number | null;
  raioKm: number | null;
  estado: EstadoColaborador;
  verificado: boolean;
  interno: boolean;
}

export type ResultadoPagina =
  | { tipo: 'pagina'; colaborador: ColaboradorPagina }
  /** Colaborador suspenso: 307 (temporário) para o Feed. Saiu ou excluído: 308 (permanente) para o Feed. */
  | { tipo: 'redirecionar'; permanente: boolean }
  /** Nunca existiu: 404 normal. */
  | { tipo: 'nao-existe' };

type Consulta = (texto: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Só endereços https, sem credenciais embutidas; qualquer outra coisa vira null (link e imagem do colaborador são texto de terceiros). */
export function urlSegura(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return u.toString();
  } catch { return null; }
}

export async function carregarColaborador(consulta: Consulta, slug: string): Promise<ResultadoPagina> {
  const r = await consulta(
    `SELECT id, slug, codigo_curto, nome, descricao, imagem_url, canal_url, regiao_cidade, regiao_uf, regiao_lat, regiao_lng, raio_km,
            estado, (verificado_em IS NOT NULL) AS verificado, interno
       FROM colaboradores WHERE lower(slug) = $1 LIMIT 1`,
    [slug.toLowerCase()],
  );
  const c = r.rows[0];
  if (!c) return { tipo: 'nao-existe' };
  const estado = String(c.estado) as EstadoColaborador;
  if (estado === 'suspenso') return { tipo: 'redirecionar', permanente: false };
  if (estado === 'saiu' || estado === 'excluido') return { tipo: 'redirecionar', permanente: true };
  return {
    tipo: 'pagina',
    colaborador: {
      id: String(c.id), slug: String(c.slug), codigoCurto: String(c.codigo_curto), nome: String(c.nome),
      descricao: txt(c.descricao), imagemUrl: urlSegura(c.imagem_url), canalUrl: urlSegura(c.canal_url),
      regiaoCidade: txt(c.regiao_cidade), regiaoUf: txt(c.regiao_uf), regiaoLat: num(c.regiao_lat), regiaoLng: num(c.regiao_lng), raioKm: num(c.raio_km),
      estado: 'ativo', verificado: Boolean(c.verificado), interno: Boolean(c.interno),
    },
  };
}

/**
 * Indexação (PC-03): só uma página ATIVA, VERIFICADA e com pelo menos uma ocorrência cadastrada com o código é indexável.
 * Qualquer outra (inclusive a ainda não verificada, mesmo com conteúdo) fica `noindex` e fora do sitemap.
 */
export function paginaIndexavel(c: Pick<ColaboradorPagina, 'estado' | 'verificado'>, ocorrenciasComCodigo: number): boolean {
  return c.estado === 'ativo' && c.verificado && ocorrenciasComCodigo > 0;
}

/** Endereço público e canônico da página. */
export const caminhoPagina = (slug: string) => `/@${slug.toLowerCase()}`;

/** Destinos dos botões de cadastro: os fluxos de sempre, com o código do colaborador já na URL. */
export function linksDeCadastro(codigoCurto: string) {
  const q = `?colab=${encodeURIComponent(codigoCurto)}`;
  return { perdi: `/flow/lost${q}`, achei: `/flow/found${q}`, roubado: `/flow/stolen${q}` };
}
