export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { SYSTEM_ACCOUNT_ID } from '@/lib/systemAccount';
import { recordEvent } from '@/lib/events';
import { PLATFORM_MESSAGE_TYPE, validatePlatformMessage } from '@/lib/platformMessage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/admin/platform-messages
 * Body: { user_id?, object_id?, title, message, link? }
 *
 * Cria uma notificação in-app (type 'platform_message') para o dono. Sem e-mail, push ou WhatsApp.
 * Com object_id, o destinatário é o dono do objeto. Recusa conta de sistema e dono legado (Webjetos).
 * Limite: 1 mensagem do mesmo admin para o mesmo usuário a cada 24 h.
 *
 * Auditoria: notifications.data guarda quem enviou (admin REAL, nunca o usuário impersonado),
 * quando e o objeto; com objeto, também há um evento 'platform_message_sent' em object_events.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: 'Body inválido' }, { status: 400 });
  }

  // Remetente real: em sessão de impersonation o token carrega impersonated_by.
  let senderId = auth.user.id;
  let senderEmail = auth.user.email;
  let impersonatedUserId: string | null = null;
  const token = req.cookies.get('access_token')?.value ?? extractTokenFromHeader(req.headers.get('authorization'));
  const payload = token ? verifyToken(token) : null;
  if (payload?.impersonated_by) {
    const real = await query(`SELECT id, email, role FROM users WHERE id = $1`, [payload.impersonated_by]);
    const r = real.rows[0] as { id: string; email: string; role: string } | undefined;
    if (!r || (r.role !== 'super_admin' && r.role !== 'admin')) {
      return NextResponse.json({ detail: 'Acesso restrito à equipe interna' }, { status: 403 });
    }
    impersonatedUserId = auth.user.id;
    senderId = r.id;
    senderEmail = r.email;
  }

  const v = validatePlatformMessage(body);
  if (!v.ok) return NextResponse.json({ detail: v.error }, { status: 400 });
  const { title, message, link } = v.value;

  let userId = typeof body.user_id === 'string' ? body.user_id : null;
  const objectId = typeof body.object_id === 'string' ? body.object_id : null;
  if ((userId && !UUID.test(userId)) || (objectId && !UUID.test(objectId))) {
    return NextResponse.json({ detail: 'Identificador inválido' }, { status: 400 });
  }
  if (!userId && !objectId) {
    return NextResponse.json({ detail: 'Informe user_id ou object_id' }, { status: 400 });
  }

  try {
    if (objectId) {
      const o = await query(`SELECT user_id FROM objects WHERE id = $1`, [objectId]);
      if (o.rows.length === 0) return NextResponse.json({ detail: 'Objeto não encontrado' }, { status: 404 });
      const owner = (o.rows[0] as { user_id: string }).user_id;
      if (userId && userId !== owner) {
        return NextResponse.json({ detail: 'O objeto não pertence a este usuário' }, { status: 400 });
      }
      userId = owner;
    }

    const u = await query(
      `SELECT u.id, COALESCE(u.is_system_account, false) AS is_system,
              EXISTS (SELECT 1 FROM objects o WHERE o.user_id = u.id AND o.is_legacy = true) AS is_legacy
       FROM users u WHERE u.id = $1`,
      [userId],
    );
    if (u.rows.length === 0) return NextResponse.json({ detail: 'Usuário não encontrado' }, { status: 404 });
    const target = u.rows[0] as { id: string; is_system: boolean; is_legacy: boolean };

    if (target.is_system || target.id === SYSTEM_ACCOUNT_ID) {
      return NextResponse.json({ detail: 'A conta de sistema não recebe mensagens' }, { status: 400 });
    }
    if (target.is_legacy) {
      return NextResponse.json(
        { detail: 'Este usuário é legado (Webjetos) e não recebe mensagens da plataforma' },
        { status: 400 },
      );
    }

    const data = {
      sent_by: senderId,
      sent_by_email: senderEmail,
      sent_at: new Date().toISOString(),
      object_id: objectId,
      ...(impersonatedUserId ? { via_impersonation_of: impersonatedUserId } : {}),
    };

    // INSERT condicional: a checagem das 24 h e a gravação acontecem num único comando.
    const ins = await query(
      `INSERT INTO notifications (user_id, type, title, message, url, data)
       SELECT $1::uuid, $2::varchar, $3::varchar, $4::text, $5::text, $6::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE user_id = $1::uuid AND type = $2::varchar AND data->>'sent_by' = $7::text
           AND created_at > NOW() - INTERVAL '24 hours'
       )
       RETURNING id, created_at`,
      [target.id, PLATFORM_MESSAGE_TYPE, title, message, link, JSON.stringify(data), senderId],
    );
    if (ins.rows.length === 0) {
      return NextResponse.json(
        { detail: 'Você já enviou uma mensagem a este usuário nas últimas 24 horas' },
        { status: 429 },
      );
    }

    if (objectId) {
      await recordEvent({
        object_id: objectId,
        type: 'platform_message_sent',
        title: 'Mensagem da plataforma enviada ao dono',
        source: 'admin',
        actor_type: 'admin',
        actor_id: senderId,
        user_id: target.id,
        metadata: { notification_id: (ins.rows[0] as { id: string }).id, via_impersonation_of: impersonatedUserId },
      });
    }

    return NextResponse.json({ id: (ins.rows[0] as { id: string }).id, sent_by: senderId }, { status: 201 });
  } catch {
    return NextResponse.json({ detail: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}
