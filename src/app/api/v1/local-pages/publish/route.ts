export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck) return adminCheck;

  try {
    const { municipality_id, category_slug } = await req.json();

    if (!municipality_id || !category_slug) {
      return NextResponse.json({ error: 'municipality_id e category_slug são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `UPDATE local_pages 
       SET status='published', published_at=NOW(), last_updated=NOW()
       WHERE municipality_id=$1 AND category_slug=$2 AND status='draft'
       RETURNING id, municipality_id, category_slug, title`,
      [municipality_id, category_slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Página não encontrada ou já publicada' }, { status: 404 });
    }

    const page = result.rows[0];

    // Buscar slug da cidade para retornar a URL
    const cityResult = await query(
      `SELECT slug FROM municipalities WHERE id = $1`,
      [municipality_id]
    );
    const citySlug = cityResult.rows[0]?.slug;
    const url = citySlug
      ? `https://backfindr.com/achados-perdidos/${citySlug}/${category_slug}`
      : null;

    return NextResponse.json({ success: true, page, url });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
