export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { retentionDays } from '@/lib/governance';

/**
 * GET /api/v1/admin/objects/trash?limit=&offset= — lixeira: ocorrências excluídas (lógica) ainda dentro da retenção.
 * Lê a tabela base de propósito (objects_active esconde os excluídos). Não expõe e-mail do dono.
 * Itens já anonimizados aparecem sem conteúdo (título genérico) e não podem ser restaurados.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
  const days = retentionDays();
  try {
    const res = await query(
      `SELECT o.id, o.title, o.status, o.category, o.is_legacy, o.deleted_at, o.deleted_by, o.deleted_reason, o.deleted_reason_text,
              o.deleted_at + make_interval(days => $3::int) AS anonymize_after, o.anonymized_at, o.macro_region, o.created_at
         FROM objects o
        WHERE o.deleted_at IS NOT NULL
        ORDER BY o.deleted_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset, days]
    );
    const total = await query(`SELECT COUNT(*)::int AS n FROM objects WHERE deleted_at IS NOT NULL`);
    return NextResponse.json({ items: res.rows, total: total.rows[0].n, retention_days: days });
  } catch (e) { return NextResponse.json({ detail: 'Erro ao listar a lixeira' }, { status: 500 }); }
}
