export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { recordEvent } from '@/lib/events';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, registrarSistema, donoRecebeAvisos, notificarSino, marcarSinoLido, meses, MESES_GUARDA_APOS_ENCERRAR, TEXTOS } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/cancelar — o achador cancela o aviso enquanto o dono não respondeu. O objeto NÃO muda.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    if (!podeFazer(c, papel, 'cancelar')) return erro('Este aviso não pode ser cancelado agora.', 409);
    const r = await query(
      `UPDATE conversas SET estado = 'cancelada', motivo = 'cancelado_achador', encerrada_em = NOW(), encerrada_por = $2, ultima_atividade = NOW(), retencao_ate = ${meses(MESES_GUARDA_APOS_ENCERRAR)}
        WHERE id = $1 AND estado = 'aguardando' RETURNING id`,
      [c.id, userId],
    );
    if (r.rows.length === 0) return erro('Este aviso não pode ser cancelado agora.', 409);
    await registrarSistema(c.id, 'Aviso cancelado.');
    // O dono (se recebe avisos) fica sabendo; o aviso antigo dele sai da conta do sino. Legado: nada.
    if (c.dono_id && await donoRecebeAvisos(c.dono_id, c.object_id)) {
      await marcarSinoLido(c.dono_id, c.id, 'conversa_aviso');
      await notificarSino(c.dono_id, { tipo: 'conversa_cancelada', titulo: TEXTOS.tituloCancelado, texto: TEXTOS.cancelado(c.objeto_titulo ?? ''), conversaId: c.id });
    }
    if (c.object_id) recordEvent({ object_id: c.object_id, type: 'conversa_cancelada', title: 'Aviso cancelado por quem achou', source: 'community', actor_type: 'user', actor_id: userId, metadata: { conversa_id: c.id } }).catch(() => {});
    return successResponse({ id: c.id, estado: 'cancelada' });
  } catch (e) { return tratarErro(e); }
}
