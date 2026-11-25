// Programa de Colaboradores (E2): páginas de colaborador no sitemap. Só com COLABORADORES_ATIVO=1 (desligado: devolve [] sem tocar no banco, e o
// sitemap fica idêntico ao de antes). Só entram páginas ATIVAS, VERIFICADAS e com ao menos uma ocorrência elegível cadastrada com o código (PC-03).
// PC-16 (modo teste): colaborador cujo @nome começa com `teste-` NUNCA entra no sitemap.
// Nunca lança erro: qualquer falha devolve [] (o sitemap não pode quebrar).
import { query } from '@/lib/db';
import { FEED_ELIGIBILITY_WHERE } from '@/lib/feed/query';
import { colaboradoresAtivo } from './rota';

export interface EntradaSitemapColaborador { url: string; lastModified?: Date; changeFrequency: 'daily'; priority: number }

export async function paginasDeColaboradorParaSitemap(base: string): Promise<EntradaSitemapColaborador[]> {
  if (!colaboradoresAtivo()) return [];
  try {
    const r = await query(
      `SELECT c.slug, max(o.created_at) AS ultima
         FROM colaboradores c
         JOIN objects o ON o.colaborador_id = c.id
        WHERE c.estado = 'ativo' AND c.verificado_em IS NOT NULL AND lower(c.slug) NOT LIKE 'teste-%' AND ${FEED_ELIGIBILITY_WHERE}
        GROUP BY c.slug
        ORDER BY c.slug
        LIMIT 5000`,
    );
    return r.rows.map((x: { slug: string; ultima: string | Date | null }) => {
      const d = x.ultima ? new Date(x.ultima) : undefined;
      return { url: `${base}/@${String(x.slug).toLowerCase()}`, ...(d && !Number.isNaN(d.getTime()) ? { lastModified: d } : {}), changeFrequency: 'daily' as const, priority: 0.5 };
    });
  } catch { return []; }
}
