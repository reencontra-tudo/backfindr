export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// POST /api/v1/admin/marketing/leads/novo-ciclo
// Arquiva todos os leads ativos e inicia um novo ciclo
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Descobrir o ciclo atual
    const cicloRes = await query(
      `SELECT COALESCE(MAX(ciclo), 1) as ciclo_atual FROM marketing_leads`,
      []
    );
    const cicloAtual = parseInt(cicloRes.rows[0].ciclo_atual);
    const novoCiclo = cicloAtual + 1;

    // Arquivar todos os leads não arquivados
    const arquivados = await query(
      `UPDATE marketing_leads 
       SET arquivado = true, updated_at = NOW()
       WHERE arquivado = false
       RETURNING id`,
      []
    );

    return NextResponse.json({
      success: true,
      arquivados: arquivados.rows.length,
      ciclo_anterior: cicloAtual,
      novo_ciclo: novoCiclo,
      mensagem: `${arquivados.rows.length} leads arquivados. Ciclo ${novoCiclo} iniciado.`,
    });
  } catch (error) {
    console.error('[marketing/leads/novo-ciclo]', error);
    return NextResponse.json({ detail: 'Erro ao iniciar novo ciclo' }, { status: 500 });
  }
}

// GET /api/v1/admin/marketing/leads/novo-ciclo
// Retorna info do ciclo atual
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT 
        COALESCE(MAX(ciclo), 1) as ciclo_atual,
        COUNT(*) FILTER (WHERE arquivado = false) as leads_ativos,
        COUNT(*) FILTER (WHERE arquivado = true) as leads_arquivados,
        COUNT(*) as total
       FROM marketing_leads`,
      []
    );
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    return NextResponse.json({ detail: 'Erro' }, { status: 500 });
  }
}
