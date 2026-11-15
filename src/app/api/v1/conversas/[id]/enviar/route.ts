export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { awaitSends } from '@/lib/awaitSends';
import { successResponse } from '@/lib/response';
import { exigirParte, erro, tratarErro } from '@/lib/conversasHttp';
import { podeFazer, validarTexto, donoRecebeAvisos, LIMITE_MENSAGEM, LIMITE_MENSAGENS_POR_MINUTO, TEXTOS } from '@/lib/conversas';

// POST /api/v1/conversas/[id]/enviar — mensagem de texto (só com a conversa aberta). Corpo: { texto }.
// Limites: até 2.000 caracteres e 20 mensagens por minuto por pessoa e conversa. O push tem texto FIXO e sai sempre.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await exigirParte(request, params.id); if (p instanceof NextResponse) return p;
    const { conversa: c, papel, userId } = p;
    if (!podeFazer(c, papel, 'enviar')) return erro('A conversa não está aberta.', 409);
    const body = await request.json().catch(() => ({}));
    const t = validarTexto(body?.texto, LIMITE_MENSAGEM);
    if (!t.ok) return erro(t.erro, 400);
    const recente = await query(`SELECT COUNT(*)::int AS n FROM mensagens_conversa WHERE conversa_id = $1 AND autor_id = $2 AND criada_em > NOW() - INTERVAL '1 minute'`, [c.id, userId]);
    if ((recente.rows[0]?.n ?? 0) >= LIMITE_MENSAGENS_POR_MINUTO) return erro('Muitas mensagens em pouco tempo. Aguarde um minuto.', 429);
    const ins = await query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto, tipo) SELECT $1, $2, $3, 'texto' WHERE EXISTS (SELECT 1 FROM conversas WHERE id = $1 AND estado = 'aberta') RETURNING id, criada_em`, [c.id, userId, t.texto]);
    if (ins.rows.length === 0) return erro('A conversa não está aberta.', 409);
    await query(`UPDATE conversas SET ultima_atividade = NOW() WHERE id = $1`, [c.id]);
    const outro = papel === 'dono' ? c.achador_id : c.dono_id;
    if (outro && await donoRecebeAvisos(outro, null)) {
      await awaitSends([sendPushToUser(outro, { title: '💬 Nova mensagem', body: TEXTOS.pushMensagem, url: `/dashboard/mensagens/${c.id}`, tag: `conversa-${c.id}` }, { event: 'chat_message' }).catch(() => {})]);
    }
    return successResponse({ id: ins.rows[0].id, criada_em: ins.rows[0].criada_em }, 201);
  } catch (e) { return tratarErro(e); }
}
