export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { successResponse } from '@/lib/response';
import { exigirParte, tratarErro } from '@/lib/conversasHttp';

// POST /api/v1/conversas/[id]/lida — marca como lidas as mensagens que o OUTRO lado escreveu
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const r = await query(
      `UPDATE mensagens_conversa SET lida_em = NOW() WHERE conversa_id = $1 AND tipo = 'texto' AND lida_em IS NULL AND autor_id IS DISTINCT FROM $2`,
      [p.conversa.id, p.userId],
    );
    return successResponse({ marcadas: r.rowCount ?? 0 });
  } catch (e) { return tratarErro(e); }
}
