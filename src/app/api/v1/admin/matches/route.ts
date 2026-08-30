export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url          = new URL(req.url);
  const page         = Math.max(1, parseInt(url.searchParams.get('page')      ?? '1',  10));
  const size         = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10)));
  const status       = url.searchParams.get('status')    ?? '';
  const min_score    = parseFloat(url.searchParams.get('min_score') ?? '0');
  // Contact Resolver (29/08/2026) — ver comentário na query abaixo.
  const needsContact = url.searchParams.get('needs_contact') === 'true';
  const offset       = (page - 1) * size;

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let idx = 1;

  if (status) { conditions.push(`m.status = $${idx}`); params.push(status); idx++; }
  if (min_score > 0) { conditions.push(`m.score >= $${idx}`); params.push(min_score); idx++; }
  // "Precisa de contato manual" — achado real (29/08/2026): match de 84%
  // entre dois Public Signals ficou pendente e correto, mas ninguém foi
  // avisado, porque nenhum dos dois lados tem conta de usuário real pra
  // notificação automática (sendMatchAlertEmail já cobre o caso de
  // usuário real, sem mudança). Aqui: pelo menos um lado é public_signal
  // E tem contato capturado na extração original (senão não há nem pra
  // quem ligar).
  if (needsContact) {
    conditions.push(`(
      (lo.source = 'public_signal' AND le.has_contact_data = true)
      OR (fo.source = 'public_signal' AND fe.has_contact_data = true)
    )`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRes, rowsRes] = await Promise.all([
      query(
        `SELECT COUNT(*) FROM matches m
         LEFT JOIN objects lo ON lo.id = m.lost_object_id
         LEFT JOIN objects fo ON fo.id = m.found_object_id
         LEFT JOIN public_signal_evidence le ON le.object_id = lo.id
         LEFT JOIN public_signal_evidence fe ON fe.object_id = fo.id
         ${where}`,
        params
      ),
      query(
        `SELECT m.id, m.score, m.status, m.created_at, m.updated_at,
                lo.id AS lost_id, lo.title AS lost_title, lo.category AS lost_category,
                lo.source AS lost_source, lo.images AS lost_images,
                fo.id AS found_id, fo.title AS found_title, fo.category AS found_category,
                fo.source AS found_source, fo.images AS found_images,
                (lo.source = 'public_signal' AND le.has_contact_data = true) AS lost_needs_contact,
                (fo.source = 'public_signal' AND fe.has_contact_data = true) AS found_needs_contact,
                latest.channel AS latest_contact_channel,
                latest.status AS latest_contact_status,
                latest.attempted_at AS latest_contact_at
         FROM matches m
         LEFT JOIN objects lo ON lo.id = m.lost_object_id
         LEFT JOIN objects fo ON fo.id = m.found_object_id
         LEFT JOIN public_signal_evidence le ON le.object_id = lo.id
         LEFT JOIN public_signal_evidence fe ON fe.object_id = fo.id
         LEFT JOIN LATERAL (
           SELECT channel, status, attempted_at
           FROM signal_contact_attempts sca
           WHERE sca.match_id = m.id
           ORDER BY sca.attempted_at DESC
           LIMIT 1
         ) latest ON true
         ${where}
         ORDER BY m.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, size, offset]
      ),
    ]);

    return NextResponse.json({
      items: rowsRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      size,
    });
  } catch (e) {
    console.error('[admin/matches GET]', e);
    return NextResponse.json({ detail: 'Erro ao buscar matches' }, { status: 500 });
  }
}
