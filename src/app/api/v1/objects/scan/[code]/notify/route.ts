export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, scanPayload } from '@/lib/pushNotification';
import { sendObjectFoundEmail } from '@/lib/email';
import { Events, recordEvent } from '@/lib/events';

export async function POST(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    // Buscar objeto pelo QR code — incluindo status para distinguir protected
    const objectResult = await query(
      `SELECT id, user_id, title, status, category FROM objects WHERE qr_code = $1`,
      [params.code]
    );

    if (objectResult.rows.length === 0) {
      return notFoundResponse();
    }

    const object = objectResult.rows[0] as { id: string; user_id: string | null; title: string; status: string; category: string };

    // Mensagem contextual: objeto protegido preventivamente vs objeto perdido
    const isProtected = object.status === 'protected';
    const notifTitle   = isProtected ? 'QR Code escaneado! 📍' : 'Seu objeto foi encontrado! 🎉';
    const notifMessage = isProtected
      ? `Alguém escaneou o QR Code do seu objeto "${object.title}". Verifique se está tudo bem.`
      : `Alguém escaneou o QR Code do seu objeto "${object.title}" e quer devolvê-lo.`;

    // Registrar notificação para o dono — `url` (migration 014, 22/08/2026)
    // aponta pra página do objeto, onde o banner de destaque de "found"
    // (item 2 do fechamento do ciclo) vive. Antes desta coluna existir, o
    // clique na notificação não levava a lugar nenhum em NENHUM dos 6
    // pontos do código que inserem em `notifications` — corrigido aqui
    // especificamente pra este fluxo; os outros 5 ficam como backlog
    // separado (ver seção 17 do BACKFINDR.md).
    const objectUrl = `/dashboard/objects/${object.id}`;
    await query(
      `INSERT INTO notifications (user_id, title, message, type, url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [object.user_id, notifTitle, notifMessage, 'scan', objectUrl]
    );

    // Atualizar status para 'found' se estava 'lost' ou 'protected'
    await query(
      `UPDATE objects SET status = 'found', updated_at = NOW()
       WHERE id = $1 AND status IN ('lost', 'protected')`,
      [object.id]
    );

    // Timeline da ocorrência (item 1 do fechamento do ciclo, 22/08/2026) —
    // Events.qrScanned/ownerNotified já existiam em src/lib/events.ts, com
    // ícone/cor já mapeados no ActivityCenterCard, mas nunca eram chamados
    // por esta rota — infraestrutura pronta, só não conectada. `owner_notified`
    // carrega `previous_status` em metadata pra alimentar o botão "Ainda não
    // recebi" no banner (reverte pro status de antes de virar 'found').
    Events.qrScanned(object.id, { via: isProtected ? 'protected_scan' : 'find_report' })
      .catch(err => console.error('[events] qrScanned failed:', err));
    if (object.user_id) {
      recordEvent({
        object_id: object.id,
        user_id: object.user_id,
        type: 'owner_notified',
        title: 'Dono notificado',
        source: 'system',
        metadata: { previous_status: object.status },
      }).catch(err => console.error('[events] ownerNotified failed:', err));
    }

    // Disparar push notification e e-mail (fire-and-forget) — só quando o
    // objeto tem dono real. Objetos legados/sem dono (user_id null, ex:
    // import Webjetos) não têm pra quem mandar nada disso.
    //
    // E-mail é item 4 do fechamento do ciclo de "encontrei" (22/08/2026) —
    // é o canal mais confiável dos três (in-app + push + e-mail), já que
    // push depende de permissão que a maioria dos donos nunca concede.
    if (object.user_id) {
      sendPushToUser(
        object.user_id,
        scanPayload(object.title, object.id)
      ).catch(err => console.error('[push] notify push failed:', err));

      query(`SELECT name, email FROM users WHERE id = $1`, [object.user_id])
        .then((userResult) => {
          const owner = userResult.rows[0] as { name: string; email: string } | undefined;
          if (!owner?.email) return;
          return sendObjectFoundEmail(owner, {
            id: object.id,
            title: object.title,
            category: object.category,
            isProtected,
          });
        })
        .catch(err => console.error('[email] notify email failed:', err));
    }

    return successResponse({ message: 'Owner notified successfully' });
  } catch (error) {
    return internalErrorResponse(error);
  }
}
