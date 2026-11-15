export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { recordEvent } from '@/lib/events';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, registrarSistema, meses, MESES_GUARDA_APOS_ENCERRAR, TEXTOS } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/encerrar — corpo: { motivo: 'devolvido' | 'desisti' }.
// «devolvido» só o dono, depois do «É o meu»; a mudança do objeto para «devolvido» é feita pelo caminho que já existia («Confirmar devolução»).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    const body = await request.json().catch(() => ({}));
    const motivo = body?.motivo;
    if (motivo !== 'devolvido' && motivo !== 'desisti') return erro('Informe o motivo: devolvido ou desisti.', 400);
    if (!podeFazer(c, papel, motivo === 'devolvido' ? 'encerrar_devolvido' : 'encerrar_desisti')) return erro('Não é possível encerrar a conversa assim agora.', 409);
    const r = await query(
      `UPDATE conversas SET estado = 'encerrada', motivo = $2, encerrada_em = NOW(), encerrada_por = $3, ultima_atividade = NOW(), retencao_ate = ${meses(MESES_GUARDA_APOS_ENCERRAR)}
        WHERE id = $1 AND estado = 'aberta' RETURNING id`,
      [c.id, motivo, userId],
    );
    if (r.rows.length === 0) return erro('Não é possível encerrar a conversa assim agora.', 409);
    await registrarSistema(c.id, TEXTOS.encerrada);
    if (c.object_id) recordEvent({ object_id: c.object_id, type: 'conversa_encerrada', title: 'Conversa encerrada', source: 'owner', actor_type: 'user', actor_id: userId, metadata: { conversa_id: c.id, motivo } }).catch(() => {});
    return successResponse({ id: c.id, estado: 'encerrada', motivo });
  } catch (e) { return tratarErro(e); }
}
