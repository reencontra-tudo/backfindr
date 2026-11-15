export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { recordEvent } from '@/lib/events';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, registrarSistema } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/e-o-meu — o dono diz «É o meu». É AQUI (e só aqui) que o objeto vira «achado pendente»
// (found_pending_confirmation), com a mesma condição que a rota antiga usava (objeto perdido ou protegido). Objeto legado não é alterado.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    if (!podeFazer(c, papel, 'e_o_meu')) return erro('Não é possível marcar «É o meu» agora.', 409);
    const r = await query(
      `UPDATE conversas SET confirmado_dono_em = NOW(), ultima_atividade = NOW() WHERE id = $1 AND estado = 'aberta' AND confirmado_dono_em IS NULL RETURNING id`,
      [c.id],
    );
    if (r.rows.length === 0) return erro('Não é possível marcar «É o meu» agora.', 409);
    let objetoMarcado = false;
    if (c.object_id) {
      const o = await query(
        `UPDATE objects SET found_pending_confirmation = true, found_pending_since = NOW()
          WHERE id = $1 AND user_id = $2 AND is_legacy IS NOT TRUE AND status IN ('lost','protected') AND found_pending_confirmation IS NOT TRUE
          RETURNING id`,
        [c.object_id, userId],
      );
      objetoMarcado = o.rows.length > 0;
      recordEvent({ object_id: c.object_id, type: 'conversa_confirmada_dono', title: 'Dono disse que o objeto é dele', source: 'owner', actor_type: 'user', actor_id: userId, metadata: { conversa_id: c.id, objeto_marcado: objetoMarcado } }).catch(() => {});
    }
    await registrarSistema(c.id, 'O dono confirmou que o objeto é dele.');
    return successResponse({ id: c.id, estado: 'aberta', confirmado: true, objeto_marcado: objetoMarcado });
  } catch (e) { return tratarErro(e); }
}
