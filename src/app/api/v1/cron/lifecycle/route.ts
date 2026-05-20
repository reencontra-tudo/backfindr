export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  sendWelcomeEmail,
  sendReactivationEmail,
  sendGuideCarTheftEmail,
  sendGuideLostPetEmail,
  sendTipPhotosEmail,
  sendPWAIncentiveEmail,
} from '@/lib/email';
import { sendPushToUser } from '@/lib/pushNotification';

/**
 * Rota de Cron Job para automação de Lifecycle Marketing
 * Deve ser chamada diariamente via Vercel Cron ou GitHub Actions
 *
 * Disparos automáticos:
 * - Dia 1: Lembretes para usuários sem objetos
 * - Dia 3: Dicas de proteção
 * - A cada 7 dias: Reativação de buscas (objetos perdidos)
 * - A cada 30 dias: Avisos de inatividade
 * - Mensalmente: Guias educativos (carros roubados, pets, etc)
 */

export async function GET(request: NextRequest) {
  // Verificar token de segurança (opcional, mas recomendado)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'default-secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const now = new Date();
    const results = {
      day1_reminders: 0,
      day3_tips: 0,
      reactivation_7days: 0,
      inactivity_30days: 0,
      educational_guides: 0,
      errors: [] as string[],
    };

    // ─── Dia 1: Lembretes para usuários sem objetos ────────────────────────
    try {
      const day1Result = await query(
        `SELECT u.id, u.email, u.name, COUNT(o.id) as object_count
         FROM users u
         LEFT JOIN objects o ON u.id = o.user_id AND o.status != 'deleted'
         WHERE u.created_at >= NOW() - INTERVAL '1 day 1 hour'
         AND u.created_at < NOW() - INTERVAL '1 day'
         AND (SELECT COUNT(*) FROM user_lifecycle_events WHERE user_id = u.id AND event_type = 'day1_reminder') = 0
         GROUP BY u.id, u.email, u.name
         HAVING COUNT(o.id) = 0`
      );

      for (const user of day1Result.rows) {
        try {
          await sendPushToUser(user.id, {
            title: '📱 Proteja seu primeiro objeto',
            body: 'Sabia que você pode proteger suas chaves ou carteira de graça? Gere seu primeiro QR Code em 2 minutos.',
            url: '/dashboard/objects/new',
            tag: 'day1_reminder',
          });

          // Registrar evento
          await query(
            `INSERT INTO user_lifecycle_events (user_id, event_type, created_at)
             VALUES ($1, 'day1_reminder', NOW())`,
            [user.id]
          ).catch(() => {});

          results.day1_reminders++;
        } catch (err) {
          results.errors.push(`Erro ao enviar dia 1 para ${user.email}: ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar usuários dia 1: ${err}`);
    }

    // ─── Dia 3: Dicas de proteção ────────────────────────────────────────
    try {
      const day3Result = await query(
        `SELECT u.id, u.email, u.name
         FROM users u
         WHERE u.created_at >= NOW() - INTERVAL '3 days 1 hour'
         AND u.created_at < NOW() - INTERVAL '3 days'
         AND (SELECT COUNT(*) FROM user_lifecycle_events WHERE user_id = u.id AND event_type = 'day3_tips') = 0`
      );

      for (const user of day3Result.rows) {
        try {
          await sendPWAIncentiveEmail(user);

          // Registrar evento
          await query(
            `INSERT INTO user_lifecycle_events (user_id, event_type, created_at)
             VALUES ($1, 'day3_tips', NOW())`,
            [user.id]
          ).catch(() => {});

          results.day3_tips++;
        } catch (err) {
          results.errors.push(`Erro ao enviar dia 3 para ${user.email}: ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar usuários dia 3: ${err}`);
    }

    // ─── A cada 7 dias: Reativação de buscas ────────────────────────────
    try {
      const reactivationResult = await query(
        `SELECT DISTINCT u.id, u.email, u.name, o.title
         FROM users u
         JOIN objects o ON u.id = o.user_id
         WHERE o.status = 'lost'
         AND o.created_at >= NOW() - INTERVAL '7 days 1 hour'
         AND o.created_at < NOW() - INTERVAL '7 days'
         AND (SELECT COUNT(*) FROM user_lifecycle_events 
              WHERE user_id = u.id AND object_id = o.id AND event_type = 'reactivation_7d') = 0
         LIMIT 100`
      );

      for (const row of reactivationResult.rows) {
        try {
          await sendReactivationEmail(
            { name: row.name, email: row.email },
            row.title
          );

          // Registrar evento
          await query(
            `INSERT INTO user_lifecycle_events (user_id, object_id, event_type, created_at)
             VALUES ($1, (SELECT id FROM objects WHERE user_id = $1 AND title = $2 LIMIT 1), 'reactivation_7d', NOW())`,
            [row.id, row.title]
          ).catch(() => {});

          results.reactivation_7days++;
        } catch (err) {
          results.errors.push(`Erro ao enviar reativação para ${row.email}: ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar objetos para reativação: ${err}`);
    }

    // ─── A cada 30 dias: Avisos de inatividade ──────────────────────────
    try {
      const inactivityResult = await query(
        `SELECT u.id, u.email, u.name
         FROM users u
         WHERE u.last_login < NOW() - INTERVAL '30 days'
         AND (SELECT COUNT(*) FROM user_lifecycle_events WHERE user_id = u.id AND event_type = 'inactivity_30d') = 0
         LIMIT 100`
      );

      for (const user of inactivityResult.rows) {
        try {
          await sendPushToUser(user.id, {
            title: '👋 Faz um tempo que não te vemos',
            body: 'Veja as novidades que lançamos para proteger seus pertences.',
            url: '/dashboard',
            tag: 'inactivity_30d',
          });

          // Registrar evento
          await query(
            `INSERT INTO user_lifecycle_events (user_id, event_type, created_at)
             VALUES ($1, 'inactivity_30d', NOW())`,
            [user.id]
          ).catch(() => {});

          results.inactivity_30days++;
        } catch (err) {
          results.errors.push(`Erro ao enviar inatividade para ${user.email}: ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao buscar usuários inativos: ${err}`);
    }

    // ─── Mensalmente: Guias educativos ──────────────────────────────────
    try {
      // Determinar qual guia enviar baseado no dia do mês
      const dayOfMonth = now.getDate();
      let guideFunction: (user: { name: string; email: string }) => Promise<void>;
      let eventType: string;

      if (dayOfMonth >= 1 && dayOfMonth <= 10) {
        guideFunction = sendGuideCarTheftEmail;
        eventType = 'guide_car_theft';
      } else if (dayOfMonth >= 11 && dayOfMonth <= 20) {
        guideFunction = sendGuideLostPetEmail;
        eventType = 'guide_lost_pet';
      } else {
        guideFunction = sendTipPhotosEmail;
        eventType = 'guide_photos_tip';
      }

      const guidesResult = await query(
        `SELECT u.id, u.email, u.name
         FROM users u
         WHERE u.is_active = true
         AND (SELECT COUNT(*) FROM user_lifecycle_events 
              WHERE user_id = u.id AND event_type = $1 
              AND created_at >= NOW() - INTERVAL '30 days') = 0
         LIMIT 500`,
        [eventType]
      );

      for (const user of guidesResult.rows) {
        try {
          await guideFunction(user);

          // Registrar evento
          await query(
            `INSERT INTO user_lifecycle_events (user_id, event_type, created_at)
             VALUES ($1, $2, NOW())`,
            [user.id, eventType]
          ).catch(() => {});

          results.educational_guides++;
        } catch (err) {
          results.errors.push(`Erro ao enviar guia para ${user.email}: ${err}`);
        }
      }
    } catch (err) {
      results.errors.push(`Erro ao enviar guias educativos: ${err}`);
    }

    console.log('[cron/lifecycle] Resultado:', results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron/lifecycle] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500 }
    );
  }
}
