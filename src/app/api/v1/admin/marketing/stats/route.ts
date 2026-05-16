import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [totalRes, hojeRes, statusRes, redeRes, keywordRes, tipoRes, cidadeRes] = await Promise.all([
      // Total geral
      query(`SELECT COUNT(*) as total FROM marketing_leads`),
      // Leads de hoje
      query(`SELECT COUNT(*) as hoje FROM marketing_leads WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      // Por status
      query(`SELECT status, COUNT(*) as count FROM marketing_leads GROUP BY status`),
      // Por rede
      query(`SELECT rede, COUNT(*) as count FROM marketing_leads GROUP BY rede ORDER BY count DESC`),
      // Top keywords
      query(`SELECT keyword, COUNT(*) as count FROM marketing_leads WHERE keyword IS NOT NULL AND keyword != '' GROUP BY keyword ORDER BY count DESC LIMIT 10`),
      // Por tipo de item
      query(`SELECT tipo_item, COUNT(*) as count FROM marketing_leads GROUP BY tipo_item ORDER BY count DESC`),
      // Por cidade (top 10)
      query(`SELECT cidade, COUNT(*) as count FROM marketing_leads WHERE cidade IS NOT NULL AND cidade != '' GROUP BY cidade ORDER BY count DESC LIMIT 10`),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of statusRes.rows) {
      statusMap[row.status] = Number(row.count);
    }

    const total = Number(totalRes.rows[0]?.total ?? 0);
    const hoje = Number(hojeRes.rows[0]?.hoje ?? 0);
    const abordados = (statusMap['abordado'] ?? 0) + (statusMap['respondeu'] ?? 0) + (statusMap['convertido'] ?? 0);
    const responderam = (statusMap['respondeu'] ?? 0) + (statusMap['convertido'] ?? 0);
    const convertidos = statusMap['convertido'] ?? 0;
    const descartados = statusMap['descartado'] ?? 0;
    const quentes = Object.entries(statusMap)
      .filter(([s]) => s !== 'descartado')
      .reduce((acc, [, v]) => acc + v, 0);

    const taxa = total > 0 ? Math.round((convertidos / total) * 100) : 0;

    // Abordados hoje
    const abordadosHojeRes = await query(
      `SELECT COUNT(*) as count FROM marketing_leads 
       WHERE status IN ('abordado','respondeu','convertido') 
       AND updated_at >= NOW() - INTERVAL '24 hours'`
    );
    const abordadosHoje = Number(abordadosHojeRes.rows[0]?.count ?? 0);

    return NextResponse.json({
      total,
      hoje,
      abordadosHoje,
      convertidos,
      descartados,
      quentes,
      taxa,
      funil: {
        captados: total,
        abordados,
        responderam,
        convertidos,
      },
      porRede: redeRes.rows.map((r) => ({ rede: r.rede, count: Number(r.count) })),
      topKeywords: keywordRes.rows.map((r) => ({ keyword: r.keyword, count: Number(r.count) })),
      porTipoItem: tipoRes.rows.map((r) => ({ tipo: r.tipo_item, count: Number(r.count) })),
      porCidade: cidadeRes.rows.map((r) => ({ cidade: r.cidade, count: Number(r.count) })),
    });
  } catch (error) {
    console.error('[marketing/stats GET]', error);
    return NextResponse.json({ detail: 'Erro ao buscar stats' }, { status: 500 });
  }
}
