export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

// ─── Contact Resolver (29/08/2026) ─────────────────────────────────────────
// Registro manual de tentativas de contato pra matches onde pelo menos um
// lado é Public Signal (sem conta de usuário real, não elegível pra
// notificação automática — ver comentário em admin/matches/route.ts).
// Uma linha por tentativa, não por match: cobre reincidência/follow-up sem
// perder histórico. Escopo mínimo aprovado por Marcos — sem automação de
// envio de mensagem, só rastreio do que já foi feito por fora.

// ─── GET /api/v1/admin/matches/[id]/contact-attempts ───────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await query(
      `SELECT sca.id, sca.object_id, sca.channel, sca.status, sca.notes, sca.attempted_at,
              u.name AS contacted_by_name
       FROM signal_contact_attempts sca
       JOIN users u ON u.id = sca.contacted_by
       WHERE sca.match_id = $1
       ORDER BY sca.attempted_at DESC`,
      [params.id]
    );
    return NextResponse.json({ items: result.rows });
  } catch (e) {
    console.error('[admin/matches/[id]/contact-attempts GET]', e);
    return NextResponse.json({ detail: 'Erro ao buscar tentativas de contato' }, { status: 500 });
  }
}

// ─── POST /api/v1/admin/matches/[id]/contact-attempts ──────────────────────
// Body: { object_id: string, channel: string, status: string, notes?: string }
// object_id: qual lado do match foi contatado (lost_object_id ou
// found_object_id) — validado abaixo contra o match real, pra não deixar
// registrar tentativa num objeto que não pertence a este match.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user: adminUser } = auth;

  const body = await req.json().catch(() => ({}));
  const { object_id, channel, status, notes } = body as {
    object_id?: string; channel?: string; status?: string; notes?: string;
  };

  if (!object_id || !channel || !status) {
    return NextResponse.json({ detail: 'object_id, channel e status são obrigatórios' }, { status: 400 });
  }

  try {
    const matchRes = await query(
      `SELECT lost_object_id, found_object_id FROM matches WHERE id = $1`,
      [params.id]
    );
    if (matchRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Match não encontrado' }, { status: 404 });
    }
    const match = matchRes.rows[0];
    if (object_id !== match.lost_object_id && object_id !== match.found_object_id) {
      return NextResponse.json({ detail: 'object_id não pertence a este match' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO signal_contact_attempts
         (match_id, object_id, contacted_by, channel, status, notes, attempted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, object_id, channel, status, notes, attempted_at`,
      [params.id, object_id, adminUser.id, channel, status, notes || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    console.error('[admin/matches/[id]/contact-attempts POST]', e);
    return NextResponse.json({ detail: 'Erro ao registrar tentativa de contato' }, { status: 500 });
  }
}
