export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { awaitSends } from '@/lib/awaitSends';
import { recordEvent } from '@/lib/events';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, registrarSistema, donoRecebeAvisos, meses, MESES_GUARDA_APOS_ENCERRAR, TEXTOS } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/recusar — «Não é meu». Recusa a conversa; o objeto NÃO muda. Guarda retencao_ate (12 meses), sem apagar nada.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    if (!podeFazer(c, papel, 'recusar')) return erro('Esta conversa não pode ser recusada agora.', 409);
    const r = await query(
      `UPDATE conversas SET estado = 'recusada', motivo = 'recusada', encerrada_em = NOW(), encerrada_por = $2, ultima_atividade = NOW(), retencao_ate = ${meses(MESES_GUARDA_APOS_ENCERRAR)}
        WHERE id = $1 AND estado IN ('aguardando','aberta') AND confirmado_dono_em IS NULL RETURNING id`,
      [c.id, userId],
    );
    if (r.rows.length === 0) return erro('Esta conversa não pode ser recusada agora.', 409);
    await registrarSistema(c.id, TEXTOS.recusadaParaAchador);
    if (c.object_id) recordEvent({ object_id: c.object_id, type: 'conversa_recusada', title: 'Dono respondeu que o objeto não é dele', source: 'owner', actor_type: 'user', actor_id: userId, metadata: { conversa_id: c.id } }).catch(() => {});
    if (c.achador_id && await donoRecebeAvisos(c.achador_id, null)) {
      const url = `/dashboard/mensagens/${c.id}`;
      await query(`INSERT INTO notifications (user_id, title, message, type, url, created_at) VALUES ($1, $2, $3, 'conversa_recusada', $4, NOW())`, [c.achador_id, 'Resposta ao seu aviso', TEXTOS.recusadaParaAchador, url]).catch(() => {});
      await awaitSends([sendPushToUser(c.achador_id, { title: 'Resposta ao seu aviso', body: TEXTOS.recusadaParaAchador, url, tag: `conversa-${c.id}` }, { event: 'chat_message' }).catch(() => {})]);
    }
    return successResponse({ id: c.id, estado: 'recusada' });
  } catch (e) { return tratarErro(e); }
}
