export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { successResponse } from '@/lib/response';
import { exigirLogin, tratarErro } from '@/lib/conversasHttp';

// GET /api/v1/conversas/resumo — números do menu «Mensagens»: avisos aguardando o usuário e mensagens não lidas.
export async function GET(request: NextRequest) {
  const a = exigirLogin(request); if (a instanceof NextResponse) return a;
  try {
    const r = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM conversas WHERE dono_id = $1 AND estado = 'aguardando') AS aguardando_voce,
         (SELECT COUNT(*)::int FROM mensagens_conversa m JOIN conversas c ON c.id = m.conversa_id
           WHERE (c.dono_id = $1 OR c.achador_id = $1) AND c.estado = 'aberta' AND m.tipo = 'texto'
             AND m.lida_em IS NULL AND m.autor_id IS DISTINCT FROM $1) AS nao_lidas`,
      [a.userId],
    );
    const { aguardando_voce, nao_lidas } = r.rows[0] as { aguardando_voce: number; nao_lidas: number };
    return successResponse({ aguardando_voce, nao_lidas, total: aguardando_voce + nao_lidas });
  } catch (e) { return tratarErro(e); }
}
