export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

// GET /api/v1/custody/items/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT c.*,
              cust.name  AS custodiante_nome,
              dest.name  AS destinatario_user_nome,
              cond.nome  AS condominio_nome,
              cond.slug  AS condominio_slug
       FROM custodias c
       LEFT JOIN users cust       ON cust.id = c.custodiante_id
       LEFT JOIN users dest       ON dest.id = c.destinatario_user_id
       LEFT JOIN condominios cond ON cond.id = c.condominio_id
       WHERE c.id = $1 AND c.remetente_id = $2`,
      [params.id, auth.user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Custódia não encontrada' }, { status: 404 });
    }

    // Buscar cadeia de eventos
    const eventos = await query(
      `SELECT ce.*, u.name AS user_nome
       FROM custody_eventos ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.custodia_id = $1
       ORDER BY ce.created_at ASC`,
      [params.id]
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backfindr.com';

    return NextResponse.json({
      ...res.rows[0],
      link_url: `${appUrl}/custody/${res.rows[0].link_token}`,
      eventos:  eventos.rows,
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
