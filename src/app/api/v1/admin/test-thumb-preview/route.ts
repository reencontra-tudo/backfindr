export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ─── One-off: cria/limpa dados descartáveis pra testar a prévia de imagem
// em /admin/matches (30/08/2026) — sem foto real na base (2160 objetos,
// nenhum com imagem), esta rota cria 2 objetos de teste (um com foto, um
// sem) + um match entre eles, só pra verificação visual. body.action:
// 'create' | 'cleanup'.
const TEST_TAG = '__TESTE_THUMB_PREVIEW__';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.MIGRATION_SECRET;
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (body.action === 'add_found_image') {
      await query(`UPDATE objects SET images = $1 WHERE title = $2 AND status = 'found'`, [JSON.stringify([TINY_PNG]), TEST_TAG]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'cleanup') {
      await query(`DELETE FROM matches WHERE lost_object_id IN (SELECT id FROM objects WHERE title = $1)`, [TEST_TAG]);
      const del = await query(`DELETE FROM objects WHERE title = $1 RETURNING id`, [TEST_TAG]);
      return NextResponse.json({ deleted: del.rows.length });
    }

    // action === 'create' (padrão)
    const qr1 = 'TEST' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const qr2 = 'TEST' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const lost = await query(
      `INSERT INTO objects (user_id, title, description, status, category, type, images, qr_code, is_public, category_fields, source, is_legacy, created_at, updated_at)
       VALUES ('11111111-1111-4111-8111-111111111111', $1, 'objeto de teste com foto', 'lost', 'pet', 'pet', $2, $3, false, '{}', 'manual_other', false, NOW(), NOW())
       RETURNING id`,
      [TEST_TAG, JSON.stringify([TINY_PNG]), qr1]
    );
    const found = await query(
      `INSERT INTO objects (user_id, title, description, status, category, type, images, qr_code, is_public, category_fields, source, is_legacy, created_at, updated_at)
       VALUES ('11111111-1111-4111-8111-111111111111', $1, 'objeto de teste sem foto', 'found', 'pet', 'pet', $2, $3, false, '{}', 'manual_other', false, NOW(), NOW())
       RETURNING id`,
      [TEST_TAG, JSON.stringify([]), qr2]
    );
    const match = await query(
      `INSERT INTO matches (lost_object_id, found_object_id, score, status, created_at, updated_at)
       VALUES ($1, $2, 77, 'pending', NOW(), NOW())
       RETURNING id`,
      [lost.rows[0].id, found.rows[0].id]
    );

    return NextResponse.json({
      lost_id: lost.rows[0].id,
      found_id: found.rows[0].id,
      match_id: match.rows[0].id,
    });
  } catch (e) {
    console.error('[test-thumb-preview]', e);
    return NextResponse.json({ detail: 'Erro', error: String(e) }, { status: 500 });
  }
}
