export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/adminGuard';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const res = await query(
      `SELECT u.id, u.numero, u.bloco,
              c.id        AS condominio_id,
              c.nome      AS condominio_nome,
              c.slug      AS condominio_slug,
              c.logo_url  AS condominio_logo,
              c.cidade, c.estado,
              (SELECT COUNT(*) FROM encomendas e
               WHERE e.unidade_id = u.id
               AND e.status IN ('pendente','aguardando','registrado'))::int
                           AS encomendas_pendentes,
              (SELECT e2.created_at FROM encomendas e2
               WHERE e2.unidade_id = u.id
               AND e2.status IN ('pendente','aguardando','registrado')
               ORDER BY e2.created_at DESC LIMIT 1)
                           AS ultima_encomenda
       FROM unidades u
       JOIN condominios c ON c.id = u.condominio_id
       WHERE u.user_id = \ AND c.active = true
       ORDER BY u.created_at DESC
       LIMIT 1`,
      [auth.user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Nenhuma unidade vinculada' }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
