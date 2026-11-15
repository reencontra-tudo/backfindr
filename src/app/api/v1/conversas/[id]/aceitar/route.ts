export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { awaitSends } from '@/lib/awaitSends';
import { recordEvent } from '@/lib/events';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, donoAindaPodeAceitar, registrarSistema, donoRecebeAvisos, notificarSino, marcarSinoLido, TEXTOS } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/aceitar — o dono aceita conversar. NÃO muda o objeto.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    if (!podeFazer(c, papel, 'aceitar')) return erro('Esta conversa não pode ser aceita agora.', 409);
    if (!donoAindaPodeAceitar(c)) return erro('Este aviso é antigo demais para ser aceito.', 410);
    const r = await query(
      `UPDATE conversas SET estado = 'aberta', aceita_em = NOW(), ultima_atividade = NOW() WHERE id = $1 AND estado = 'aguardando' RETURNING id`,
      [c.id],
    );
    if (r.rows.length === 0) return erro('Esta conversa não pode ser aceita agora.', 409);
    await registrarSistema(c.id, 'Conversa aceita.');
    await marcarSinoLido(userId, c.id, 'conversa_aviso');   // o aviso já foi tratado: sai da conta do sino
    if (c.object_id) recordEvent({ object_id: c.object_id, type: 'conversa_aceita', title: 'Dono aceitou conversar', source: 'owner', actor_type: 'user', actor_id: userId, metadata: { conversa_id: c.id } }).catch(() => {});
    // Avisa quem achou (texto fixo). Achador é sempre conta ativa; mesmo assim só se puder receber.
    if (c.achador_id && await donoRecebeAvisos(c.achador_id, null)) {
      const url = `/dashboard/mensagens/${c.id}`;
      await notificarSino(c.achador_id, { tipo: 'conversa_aceita', titulo: '💬 O dono aceitou conversar', texto: TEXTOS.aceitaParaAchador, conversaId: c.id });
      await awaitSends([sendPushToUser(c.achador_id, { title: '💬 O dono aceitou conversar', body: TEXTOS.aceitaParaAchador, url, tag: `conversa-${c.id}` }, { event: 'chat_message' }).catch(() => {})]);
    }
    return successResponse({ id: c.id, estado: 'aberta' });
  } catch (e) { return tratarErro(e); }
}
