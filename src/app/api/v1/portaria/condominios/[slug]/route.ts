export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/v1/portaria/condominios/[slug]
// Público — morador acessa pelo link personalizado para se cadastrar
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const res = await query(
      `SELECT id, nome, slug, endereco, cidade, estado, total_unidades, logo_url, active
       FROM condominios
       WHERE slug = $1 AND active = true`,
      [params.slug]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ detail: 'Condomínio não encontrado' }, { status: 404 });
    }

    const cond = res.rows[0];

    // Retornar também contagem de moradores cadastrados
    const moradores = await query(
      `SELECT COUNT(*) FROM unidades WHERE condominio_id = $1 AND user_id IS NOT NULL`,
      [cond.id]
    );

    return NextResponse.json({
      ...cond,
      moradores_cadastrados: parseInt(moradores.rows[0].count, 10),
    });
  } catch (e: unknown) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
