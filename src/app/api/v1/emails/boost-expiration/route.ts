import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/response';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

interface BoostExpiration {
  id: string;
  user_id: string;
  object_id: string;
  object_title: string;
  user_email: string;
  expires_at: string;
  type: string;
  days_remaining: number;
}

/**
 * POST /api/v1/emails/boost-expiration
 * Envia emails de notificação de expiração de boost
 * Pode ser chamado por cron job ou manualmente
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar se é chamado por cron (header x-cron-secret)
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret !== expectedSecret) {
      return errorResponse('Unauthorized', 401);
    }

    // Buscar notificações de boost que precisam de email
    const result = await query(
      `
      SELECT 
        bn.id as notification_id,
        bn.day,
        b.id as boost_id,
        b.user_id,
        b.object_id,
        b.expires_at,
        b.type,
        o.title as object_title,
        u.email as user_email,
        EXTRACT(DAY FROM (b.expires_at - NOW()))::int as days_remaining
      FROM boost_notifications bn
      JOIN boosts b ON bn.object_id = b.object_id AND bn.user_id = b.user_id
      JOIN objects o ON b.object_id = o.id
      JOIN auth.users u ON b.user_id = u.id
      WHERE b.status = 'active'
        AND b.expires_at > NOW()
        AND bn.sent_at > NOW() - INTERVAL '24 hours'
      ORDER BY b.expires_at ASC
      LIMIT 100
      `
    );

    if (result.rows.length === 0) {
      return successResponse({
        message: 'No boost expiration emails to send',
        count: 0,
      });
    }

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    for (const row of result.rows) {
      try {
        const boostExpiration = row as BoostExpiration;

        // Determinar mensagem baseada em dias restantes
        let subject = '';
        let message = '';

        if (boostExpiration.days_remaining === 3) {
          subject = `Seu Boost expira em 3 dias! 🚀`;
          message = `Seu boost para "${boostExpiration.object_title}" expira em 3 dias. Renove agora para manter a visibilidade!`;
        } else if (boostExpiration.days_remaining === 1) {
          subject = `Último dia do seu Boost! ⏰`;
          message = `Seu boost para "${boostExpiration.object_title}" expira amanhã. Renove agora para continuar em destaque!`;
        } else {
          continue; // Ignorar outros dias
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://backfindr.com';
        const renewUrl = `${appUrl}/dashboard/objects/${boostExpiration.object_id}?action=renew-boost`;

        // Enviar email
        await sendEmail({
          to: boostExpiration.user_email,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #14b8a6;">${subject}</h2>
              <p>${message}</p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Objeto:</strong> ${boostExpiration.object_title}</p>
                <p><strong>Tipo de Boost:</strong> ${boostExpiration.type === 'boost_7' ? '7 dias' : boostExpiration.type === 'boost_30' ? '30 dias' : 'Alerta de Área'}</p>
                <p><strong>Expira em:</strong> ${new Date(boostExpiration.expires_at).toLocaleDateString('pt-BR')}</p>
              </div>

              <a href="${renewUrl}" style="display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Renovar Boost Agora
              </a>

              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Se você não deseja renovar, seu objeto continuará visível normalmente na plataforma após a expiração do boost.
              </p>
            </div>
          `,
        });

        emailsSent.push(boostExpiration.user_email);

        // Marcar como enviado (atualizar sent_at para evitar reenvios)
        await query(
          `UPDATE boost_notifications 
           SET sent_at = NOW() 
           WHERE id = $1`,
          [row.notification_id]
        );
      } catch (emailError) {
        console.error('Error sending boost expiration email:', emailError);
        emailsFailed.push(row.user_email);
      }
    }

    return successResponse({
      message: 'Boost expiration emails processed',
      emailsSent: emailsSent.length,
      emailsFailed: emailsFailed.length,
      details: {
        sent: emailsSent,
        failed: emailsFailed,
      },
    });
  } catch (error) {
    console.error('Error in boost expiration email route:', error);
    return internalErrorResponse(error);
  }
}

/**
 * GET /api/v1/emails/boost-expiration
 * Health check endpoint
 */
export async function GET() {
  return successResponse({
    status: 'ok',
    message: 'Boost expiration email service is running',
  });
}
