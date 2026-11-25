// Programa de Colaboradores (E8): contador de VISITAS por colaborador e dia. SOMENTE SERVIDOR. AGREGADO: nenhum IP, cookie, identificador, dispositivo, URL de origem ou texto de cabeçalho é lido,
// gravado ou registrado em log (DESENHO §3.8; decisão #13: «contador próprio mínimo»). Conta também robôs: é um número APROXIMADO. Para não inflar o banco, há um teto de contagens por minuto
// por @nome, em memória da instância (sem identificar ninguém). INTERRUPTOR: `COLABORADORES_VISITAS=1` (além de `COLABORADORES_ATIVO=1`). Ausente = nada é contado.
import { SLUG_REGEX } from './rota';
import type { Consulta } from './comissao';

export const visitasAtivas = (env: Record<string, string | undefined> = process.env): boolean => env.COLABORADORES_ATIVO === '1' && env.COLABORADORES_VISITAS === '1';

export const TETO_POR_MINUTO_E_NOME = 120;
const JANELA_MS = 60_000, MAX_NOMES = 5000;
const usos = new Map<string, { inicio: number; n: number }>();

/** true = passou do teto (não contar). Só o @nome entra na chave. */
export function acimaDoTeto(slug: string, agora = Date.now()): boolean {
  if (usos.size > MAX_NOMES) usos.clear();
  const u = usos.get(slug);
  if (!u || agora - u.inicio >= JANELA_MS) { usos.set(slug, { inicio: agora, n: 1 }); return false; }
  u.n += 1; return u.n > TETO_POR_MINUTO_E_NOME;
}
export const zerarTeto = () => usos.clear();

export const slugDeVisita = (v: unknown): string | null => { const s = typeof v === 'string' ? v.trim().toLowerCase() : ''; return SLUG_REGEX.test(s) ? s : null; };

/** Soma 1 à contagem do dia (UTC) do colaborador ATIVO com esse @nome. Devolve false se o @nome não existe ou não está ativo. */
export async function registrarVisita(consulta: Consulta, slug: string, agora: Date = new Date()): Promise<boolean> {
  const r = await consulta(
    `INSERT INTO colaborador_visitas_dia (colaborador_id, dia, visitas) SELECT id, $2::date, 1 FROM colaboradores WHERE lower(slug) = $1 AND estado = 'ativo' AND interno = FALSE
     ON CONFLICT (colaborador_id, dia) DO UPDATE SET visitas = colaborador_visitas_dia.visitas + 1 RETURNING visitas`,
    [slug, agora.toISOString().slice(0, 10)],
  );
  return r.rows.length > 0;
}

/** Visitas do mês (AAAA-MM, UTC) por colaborador. */
export async function visitasDoMes(consulta: Consulta, mes: string): Promise<Map<string, number>> {
  const r = await consulta(
    `SELECT colaborador_id, COALESCE(SUM(visitas), 0)::int AS n FROM colaborador_visitas_dia WHERE dia >= ($1 || '-01')::date AND dia < (($1 || '-01')::date + interval '1 month') GROUP BY colaborador_id`, [mes]);
  return new Map(r.rows.map((x) => [String(x.colaborador_id), Number(x.n)]));
}
