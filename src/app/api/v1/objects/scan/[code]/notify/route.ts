export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/response';
import { sendPushToUser, scanPayload } from '@/lib/pushNotification';
import { sendObjectFoundEmail } from '@/lib/email';
import { Events, recordEvent } from '@/lib/events';

// Mitigação de segurança (item 3b do ciclo found→returned, 25/08/2026):
// esta rota é pública e sem autenticação nenhuma — qualquer um que escaneie
// o QR físico (ou monte a URL manualmente) pode chamá-la. Marcos já
// acionou isso sem querer numa sessão anterior. Duas mudanças:
//
// 1. Não flipa mais `status` pra 'found' sozinha — só marca
//    `found_pending_confirmation`, um campo isolado que só decide se o
//    FoundBanner aparece (ver comentário completo lá,
//    src/app/dashboard/objects/[id]/page.tsx). Uma sinalização anônima
//    falsa/mal-intencionada nunca mais contamina o status real do objeto,
//    que só muda quando o próprio dono confirma a devolução.
// 2. Cooldown entre notificações pro mesmo objeto — sem isso, scans
//    repetidos (curiosidade ou má intenção) spammavam push/e-mail/in-app
//    do dono a cada clique, sem limite nenhum.
const NOTIFY_COOLDOWN_MINUTES = 15;

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

    // Cooldown — se o dono já foi notificado recentemente sobre este
    // objeto, não repete. `owner_notified` é o mesmo evento gravado mais
    // abaixo, então isso também é idempotente entre chamadas concorrentes.
    const lastNotify = await query(
      `SELECT created_at FROM object_events
       WHERE object_id = $1 AND type = 'owner_notified'
       ORDER BY created_at DESC LIMIT 1`,
      [object.id]
    );
    if (lastNotify.rows.length > 0) {
      const minutesSince = (Date.now() - new Date(lastNotify.rows[0].created_at as string).getTime()) / 60000;
      if (minutesSince < NOTIFY_COOLDOWN_MINUTES) {
        return successResponse({ message: 'Owner already notified recently' });
      }
    }

    // Mensagem contextual: objeto protegido preventivamente vs objeto perdido
    const isProtected = object.status === 'protected';
    const notifTitle   = isProtected ? 'QR Code escaneado! 📍' : 'Alguém sinalizou que encontrou seu objeto 👀';
    const notifMessage = isProtected
      ? `Alguém escaneou o QR Code do seu objeto "${object.title}". Verifique se está tudo bem.`
      : `Alguém escaneou o QR Code do seu objeto "${object.title}" dizendo que quer devolvê-lo. Confirme na página do objeto antes de combinar qualquer coisa.`;

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

    // Sinaliza found_pending_confirmation em vez de mudar `status` direto.
    // Mesmo escopo de elegibilidade que o UPDATE de status tinha antes
    // (só lost/protected) — 'stolen'/'found'/'returned'/'archived'
    // continuam só recebendo a notificação de scan, sem acionar o banner.
    await query(
      `UPDATE objects SET found_pending_confirmation = true, found_pending_since = NOW()
       WHERE id = $1 AND status IN ('lost', 'protected') AND found_pending_confirmation = false`,
      [object.id]
    );

    // Timeline da ocorrência (item 1 do fechamento do ciclo, 22/08/2026) —
    // Events.qrScanned/ownerNotified já existiam em src/lib/events.ts, com
    // ícone/cor já mapeados no ActivityCenterCard, mas nunca eram chamados
    // por esta rota — infraestrutura pronta, só não conectada.
    Events.qrScanned(object.id, { via: isProtected ? 'protected_scan' : 'find_report' })
      .catch(err => console.error('[events] qrScanned failed:', err));
    if (object.user_id) {
      recordEvent({
        object_id: object.id,
        user_id: object.user_id,
        type: 'owner_notified',
        title: 'Dono notificado',
        source: 'system',
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
