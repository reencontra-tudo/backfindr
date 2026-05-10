export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para migração em lote

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { uploadToR2, isR2Url, detectMimeType } from '@/lib/storage';

/**
 * POST /api/v1/admin/r2/migrate
 * Migra imagens Base64 do banco para o Cloudflare R2.
 *
 * Body: { limit?: number, dry_run?: boolean }
 *   limit   — quantos objetos processar por chamada (padrão: 50)
 *   dry_run — apenas conta, não faz upload (padrão: false)
 *
 * Retorna: { processed, migrated, skipped, errors, total_pending }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard instanceof NextResponse) return guard;

  // Verificar credenciais R2
  if (
    !process.env.R2_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    return NextResponse.json(
      { error: 'R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in Vercel environment variables.' },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 50, 200);
  const dryRun = body.dry_run === true;

  // Contar total pendente (imagens que ainda são Base64)
  const countResult = await query(`
    SELECT COUNT(*) as total
    FROM objects
    WHERE images IS NOT NULL
      AND images != '[]'
      AND images != 'null'
      AND images::text LIKE '%data:image%'
  `);
  const totalPending = Number(countResult.rows[0]?.total || 0);

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      total_pending: totalPending,
      message: `${totalPending} objeto(s) com imagens Base64 para migrar.`,
    });
  }

  // Buscar objetos com imagens Base64
  const objectsResult = await query(`
    SELECT id, images
    FROM objects
    WHERE images IS NOT NULL
      AND images != '[]'
      AND images != 'null'
      AND images::text LIKE '%data:image%'
    LIMIT $1
  `, [limit]);

  const objects = objectsResult.rows;
  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const obj of objects) {
    processed++;
    try {
      let images: string[] = [];
      const raw = obj.images;
      if (Array.isArray(raw)) images = raw;
      else if (typeof raw === 'string') images = JSON.parse(raw);

      if (images.length === 0) { skipped++; continue; }

      // Migrar apenas as que ainda são Base64
      const newImages: string[] = [];
      let hasMigration = false;

      for (const img of images) {
        if (isR2Url(img)) {
          // Já é URL R2 — manter
          newImages.push(img);
        } else if (img.startsWith('data:image/')) {
          // Base64 — fazer upload para R2
          const mimeType = detectMimeType(img);
          const result = await uploadToR2({
            folder: 'objects',
            entityId: obj.id,
            data: img,
            mimeType,
          });
          newImages.push(result.url);
          hasMigration = true;
        } else {
          // Formato desconhecido — manter
          newImages.push(img);
        }
      }

      if (hasMigration) {
        await query(
          `UPDATE objects SET images = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(newImages), obj.id]
        );
        migrated++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors.push({
        id: obj.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Contar quantos ainda faltam
  const remainingResult = await query(`
    SELECT COUNT(*) as total
    FROM objects
    WHERE images IS NOT NULL
      AND images != '[]'
      AND images != 'null'
      AND images::text LIKE '%data:image%'
  `);
  const remaining = Number(remainingResult.rows[0]?.total || 0);

  return NextResponse.json({
    processed,
    migrated,
    skipped,
    errors: errors.length,
    error_details: errors.slice(0, 10),
    total_pending_before: totalPending,
    remaining_after: remaining,
    complete: remaining === 0,
    message: remaining === 0
      ? 'Migração completa! Todas as imagens estão no R2.'
      : `${remaining} objeto(s) ainda com imagens Base64. Execute novamente para continuar.`,
  });
}

/**
 * GET /api/v1/admin/r2/migrate
 * Retorna estatísticas de migração sem fazer nada.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard instanceof NextResponse) return guard;

  const [base64Count, r2Count, totalCount] = await Promise.all([
    query(`SELECT COUNT(*) as n FROM objects WHERE images::text LIKE '%data:image%'`),
    query(`SELECT COUNT(*) as n FROM objects WHERE images::text LIKE '%http%' AND images::text NOT LIKE '%data:image%' AND images != '[]'`),
    query(`SELECT COUNT(*) as n FROM objects WHERE images IS NOT NULL AND images != '[]' AND images != 'null'`),
  ]);

  return NextResponse.json({
    r2_configured: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
    total_with_images: Number(totalCount.rows[0]?.n || 0),
    base64_pending: Number(base64Count.rows[0]?.n || 0),
    r2_migrated: Number(r2Count.rows[0]?.n || 0),
  });
}
