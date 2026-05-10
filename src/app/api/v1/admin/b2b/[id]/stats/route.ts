export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const partnerId = params.id;

  // b2b_admin só pode ver dados do seu próprio parceiro
  if (user.role === 'b2b_admin' && user.b2b_partner_id !== partnerId) {
    return NextResponse.json({ detail: 'Acesso negado' }, { status: 403 });
  }

  try {
    // Info do parceiro
    const partnerRes = await query(
      `SELECT name, type, city, status FROM b2b_partners WHERE id = $1`,
      [partnerId]
    );
    if (partnerRes.rows.length === 0) {
      return NextResponse.json({ detail: 'Parceiro não encontrado' }, { status: 404 });
    }
    const partner = partnerRes.rows[0] as {
      name: string; type: string; city: string; status: string;
    };

    // Stats de objetos dos usuários vinculados ao parceiro
    const statsRes = await query(
      `SELECT
        COUNT(*) FILTER (WHERE o.status IS NOT NULL) AS total_objects,
        COUNT(*) FILTER (WHERE o.status = 'lost') AS lost_objects,
        COUNT(*) FILTER (WHERE o.status = 'found') AS found_objects,
        COUNT(*) FILTER (WHERE o.status = 'returned') AS returned_objects,
        COUNT(DISTINCT u.id) AS total_users
       FROM users u
       LEFT JOIN objects o ON o.owner_id = u.id
       WHERE u.b2b_partner_id = $1`,
      [partnerId]
    );
    const s = statsRes.rows[0] as {
      total_objects: string; lost_objects: string; found_objects: string;
      returned_objects: string; total_users: string;
    };

    const totalObjects = parseInt(s.total_objects) || 0;
    const returnedObjects = parseInt(s.returned_objects) || 0;
    const recoveryRate = totalObjects > 0
      ? Math.round((returnedObjects / totalObjects) * 100)
      : 0;

    return NextResponse.json({
      partner_name: partner.name,
      partner_type: partner.type,
      partner_city: partner.city,
      partner_status: partner.status,
      total_objects: totalObjects,
      lost_objects: parseInt(s.lost_objects) || 0,
      found_objects: parseInt(s.found_objects) || 0,
      returned_objects: returnedObjects,
      total_users: parseInt(s.total_users) || 0,
      recovery_rate: recoveryRate,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
