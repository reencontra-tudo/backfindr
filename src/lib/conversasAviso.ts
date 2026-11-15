// Criar o aviso «encontrei» (conversa em «aguardando») e os avisos às partes. Usado por POST /api/v1/conversas e pela rota notify.
import { query } from '@/lib/db';
import { sendPushToUser } from '@/lib/pushNotification';
import { sendObjectFoundEmail } from '@/lib/email';
import { awaitSends } from '@/lib/awaitSends';
import { Events, recordEvent } from '@/lib/events';
import { TEXTOS, LIMITE_PRIMEIRA_MENSAGEM, LIMITE_AVISOS_NOVOS_POR_DIA, PAUSA_POR_OBJETO_MIN, donoRecebeAvisos, validarTexto, notificarSino, tituloLimpo } from '@/lib/conversas';

export type ResultadoAviso =
  | { ok: true; conversaId: string }
  | { ok: false; status: number; detail: string; conversaId?: string };

/** Aviso ao dono (sino, push de texto fixo, e-mail) — só quando o dono pode receber (não legado, não conta de sistema). Falha de envio não derruba nada. */
async function avisarDono(donoId: string, conversaId: string, objeto: { id: string; title: string; category: string; status: string }) {
  const url = `/dashboard/mensagens/${conversaId}`;
  const titulo = tituloLimpo(objeto.title);
  await notificarSino(donoId, { tipo: 'conversa_aviso', titulo: TEXTOS.tituloAvisoDono, texto: TEXTOS.avisoDono(titulo), conversaId });
  const push = sendPushToUser(donoId, { title: TEXTOS.tituloAvisoDono, body: TEXTOS.avisoDono(titulo), url, tag: `conversa-${conversaId}` }, { event: 'qr_scan' })
    .catch((e) => console.error('[conversas] push falhou:', e));
  const email = query(`SELECT name, email FROM users WHERE id = $1`, [donoId]).then((r) => {
    const dono = r.rows[0] as { name: string; email: string } | undefined;
    if (!dono?.email) return;
    return sendObjectFoundEmail(dono, { id: objeto.id, title: titulo, category: objeto.category, isProtected: objeto.status === 'protected', conversaId });
  }).catch((e) => console.error('[conversas] e-mail falhou:', e));
  await awaitSends([push, email]);
}

export async function criarAviso(achadorId: string, codigo: string, mensagemBruta: unknown): Promise<ResultadoAviso> {
  const msg = validarTexto(mensagemBruta, LIMITE_PRIMEIRA_MENSAGEM);
  if (!msg.ok) return { ok: false, status: 400, detail: msg.erro };

  const quem = await query(`SELECT COALESCE(is_legacy, false) AS legado FROM users WHERE id = $1`, [achadorId]);
  if (quem.rows.length === 0) return { ok: false, status: 401, detail: 'Entre na sua conta para avisar.' };
  if (quem.rows[0].legado === true) return { ok: false, status: 403, detail: 'Atualize a sua conta para poder avisar.' };

  const r = await query(
    `SELECT id, user_id, title, status, category, source FROM objects WHERE qr_code = $1`, [codigo],
  );
  if (r.rows.length === 0) return { ok: false, status: 404, detail: 'Not found' };
  const obj = r.rows[0] as { id: string; user_id: string | null; title: string; status: string; category: string; source: string | null };

  // Sinal público: não há dono cadastrado (mesma resposta de sempre, antes de gravar qualquer coisa)
  if (obj.source === 'public_signal') {
    return { ok: false, status: 409, detail: 'Este registro foi extraído de uma notícia pública e não tem dono cadastrado no Backfindr. Para tentar contato, procure a fonte original.' };
  }
  if (!obj.user_id) return { ok: false, status: 409, detail: 'Este registro não tem dono cadastrado no Backfindr.' };
  if (obj.user_id === achadorId) return { ok: false, status: 409, detail: 'Este objeto é seu.' };

  // 1 aviso ativo por achador e objeto
  const ativa = await query(`SELECT id FROM conversas WHERE object_id = $1 AND achador_id = $2 AND estado IN ('aguardando','aberta')`, [obj.id, achadorId]);
  if (ativa.rows.length > 0) return { ok: false, status: 409, detail: 'Você já avisou sobre este objeto.', conversaId: ativa.rows[0].id as string };

  // Pausa por objeto (como a rota antiga): outro aviso recente sobre o mesmo objeto
  const recente = await query(`SELECT 1 FROM conversas WHERE object_id = $1 AND criada_em > NOW() - ($2 || ' minutes')::interval LIMIT 1`, [obj.id, String(PAUSA_POR_OBJETO_MIN)]);
  if (recente.rows.length > 0) return { ok: false, status: 429, detail: 'Já houve um aviso recente sobre este objeto. Tente de novo em alguns minutos.' };

  // 5 avisos novos por achador por dia
  const dia = await query(`SELECT COUNT(*)::int AS n FROM conversas WHERE achador_id = $1 AND criada_em > NOW() - INTERVAL '24 hours'`, [achadorId]);
  if ((dia.rows[0]?.n ?? 0) >= LIMITE_AVISOS_NOVOS_POR_DIA) return { ok: false, status: 429, detail: 'Você atingiu o limite de avisos de hoje. Tente amanhã.' };

  let conversaId: string;
  try {
    const ins = await query(
      `INSERT INTO conversas (object_id, objeto_titulo, achador_id, dono_id, estado, primeira_mensagem)
       VALUES ($1, $2, $3, $4, 'aguardando', $5) RETURNING id`,
      [obj.id, tituloLimpo(obj.title), achadorId, obj.user_id, msg.texto],
    );
    conversaId = ins.rows[0].id as string;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { ok: false, status: 409, detail: 'Você já avisou sobre este objeto.' };
    throw e;
  }
  await query(`INSERT INTO mensagens_conversa (conversa_id, autor_id, texto, tipo) VALUES ($1, $2, $3, 'texto')`, [conversaId, achadorId, msg.texto]);

  // Eventos de analytics que já existiam (a rota antiga os gravava) + os novos conversa_*
  Events.qrScanned(obj.id, { via: obj.status === 'protected' ? 'protected_scan' : 'find_report' }).catch(() => {});
  recordEvent({ object_id: obj.id, user_id: obj.user_id, type: 'owner_notified', title: 'Dono notificado', source: 'system' }).catch(() => {});
  recordEvent({ object_id: obj.id, type: 'conversa_aviso', title: 'Aviso de quem achou (aguardando o dono)', source: 'community', actor_type: 'user', actor_id: achadorId, metadata: { conversa_id: conversaId } }).catch(() => {});

  // Só dono que recebe avisos (não legado): sino + push + e-mail. Legado: nada é enviado; a conversa fica guardada em «aguardando».
  if (await donoRecebeAvisos(obj.user_id, obj.id)) await avisarDono(obj.user_id, conversaId, obj);
  return { ok: true, conversaId };
}
