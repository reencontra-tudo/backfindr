import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { successResponse, internalErrorResponse } from '@/lib/response';

export const dynamic = 'force-dynamic';

// Dias em que as notificações de reengajamento são enviadas
const NOTIFICATION_DAYS = [3, 7, 15, 30];

const MESSAGES: Record<number, { subject: string; body: string }> = {
  3: {
    subject: 'Seu item ainda não foi encontrado 😔',
    body: `Seu item ainda não foi localizado.\n\nAumente as chances agora com um Boost 👇\nhttps://backfindr.com/dashboard\n\nQuanto antes, maior a chance de alguém te encontrar.`,
  },
  7: {
    subject: 'Já faz uma semana — vale a pena tentar 🙏',
    body: `Já faz 7 dias desde que você registrou seu item.\n\nUm Boost pode colocar sua publicação em destaque para mais pessoas 👇\nhttps://backfindr.com/dashboard\n\nLeva menos de 1 minuto.`,
  },
  15: {
    subject: 'Sua publicação está menos visível ⚠️',
    body: `Sua publicação está perdendo visibilidade com o tempo.\n\nRenove o destaque por R$ 9,90 👇\nhttps://backfindr.com/dashboard\n\nAinda dá tempo de recuperar.`,
  },
  30: {
    subject: 'Último aviso — mantenha sua busca ativa 🔔',
    body: `Já faz 30 dias. Sua publicação ainda está ativa, mas com visibilidade reduzida.\n\nMantenha sua busca ativa por mais 30 dias 👇\nhttps://backfindr.com/dashboard\n\nSeu QR Code é permanente — se alguém encontrar e escanear, você recebe o aviso.`,
  },
};

// POST /api/v1/admin/boost-notifications — executar job de notificações
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const sent: { object_id: string; user_email: string; day: number }[] = [];
  const skipped: { object_id: string; day: number; reason: string }[] = [];

  try {
    for (const day of NOTIFICATION_DAYS) {
      // Buscar objetos com status lost/stolen, sem boost ativo, criados há ~X dias
      // e que ainda não receberam notificação desse dia
      const result = await query(
        `SELECT o.id as object_id, o.title, o.created_at,
                u.id as user_id, u.email, u.name
         FROM objects o
         JOIN users u ON o.user_id = u.id
         WHERE o.status IN ('lost', 'stolen')
           AND (o.is_boosted = false OR o.boost_expires_at < NOW())
           AND o.created_at <= NOW() - INTERVAL '${day} days'
           AND o.created_at > NOW() - INTERVAL '${day + 1} days'
           AND NOT EXISTS (
             SELECT 1 FROM boost_notifications bn
             WHERE bn.object_id = o.id AND bn.day = ${day}
           )
         LIMIT 100`
      );

      for (const row of result.rows) {
        try {
          const msg = MESSAGES[day];

          // Registrar notificação como enviada
          await query(
            `INSERT INTO boost_notifications (object_id, user_id, day)
             VALUES ($1, $2, $3)
             ON CONFLICT (object_id, day) DO NOTHING`,
            [row.object_id, row.user_id, day]
          );

          // Enviar email via Resend (se configurado)
          const resendKey = process.env.RESEND_API_KEY;
          if (resendKey) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Backfindr <noreply@backfindr.com>',
                to: row.email,
                subject: msg.subject,
                text: `Olá, ${row.name}!\n\n${msg.body}`,
              }),
            });
          }

          sent.push({ object_id: row.object_id, user_email: row.email, day });
        } catch (err) {
          skipped.push({ object_id: row.object_id, day, reason: String(err) });
        }
      }
    }

    return successResponse({
      sent_count: sent.length,
      skipped_count: skipped.length,
      sent,
      skipped,
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

// GET /api/v1/admin/boost-notifications — preview de quantas notificações seriam enviadas
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const preview: { day: number; count: number }[] = [];

    for (const day of NOTIFICATION_DAYS) {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM objects o
         WHERE o.status IN ('lost', 'stolen')
           AND (o.is_boosted = false OR o.boost_expires_at < NOW())
           AND o.created_at <= NOW() - INTERVAL '${day} days'
           AND o.created_at > NOW() - INTERVAL '${day + 1} days'
           AND NOT EXISTS (
             SELECT 1 FROM boost_notifications bn
             WHERE bn.object_id = o.id AND bn.day = ${day}
           )`
      );
      preview.push({ day, count: parseInt(result.rows[0]?.count || '0') });
    }

    return successResponse({ preview });
  } catch {
    return successResponse({ preview: NOTIFICATION_DAYS.map(d => ({ day: d, count: 0 })) });
  }
}
