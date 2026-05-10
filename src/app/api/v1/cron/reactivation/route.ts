import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendReactivationEmail } from '@/lib/email';

// ─── GET /api/v1/cron/reactivation ───────────────────────────────────────────
// Chamado pelo Vercel Cron Jobs (vercel.json) ou manualmente pelo admin.
// Busca objetos com status 'lost' ou 'stolen' criados há mais de 24h,
// sem match confirmado, e envia e-mail de reativação ao dono.
// Proteção: CRON_SECRET deve ser passado no header Authorization.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Busca objetos perdidos/roubados criados há 24h-48h sem match confirmado
    // e cujo dono ainda não recebeu e-mail de reativação nas últimas 24h
    const result = await query(`
      SELECT
        o.id           AS object_id,
        o.title        AS object_title,
        u.id           AS user_id,
        u.name         AS user_name,
        u.email        AS user_email
      FROM objects o
      JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('lost', 'stolen')
        AND o.created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
        AND u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE m.object_id = o.id
            AND m.status = 'confirmed'
        )
        AND NOT EXISTS (
          SELECT 1 FROM reactivation_emails re
          WHERE re.object_id = o.id
            AND re.sent_at > NOW() - INTERVAL '24 hours'
        )
      LIMIT 100
    `);

    const rows = result.rows as Array<{
      object_id: string;
      object_title: string;
      user_id: string;
      user_name: string;
      user_email: string;
    }>;

    if (!rows.length) {
      return NextResponse.json({ sent: 0, message: 'Nenhum objeto elegível' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await sendReactivationEmail(
          { name: row.user_name, email: row.user_email },
          row.object_title,
        );

        // Registra o envio para não duplicar
        await query(
          `INSERT INTO reactivation_emails (object_id, user_id, sent_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (object_id) DO UPDATE SET sent_at = NOW()`,
          [row.object_id, row.user_id],
        );

        sent++;
      } catch (err) {
        errors.push(`${row.user_email}: ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: errors.length,
      total: rows.length,
      errors: errors.slice(0, 10),
    });

  } catch (err) {
    console.error('[cron/reactivation]', err);
    return NextResponse.json({ detail: String(err) }, { status: 500 });
  }
}
