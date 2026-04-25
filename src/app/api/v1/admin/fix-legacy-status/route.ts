export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

/**
 * POST /api/v1/admin/fix-legacy-status
 * Corrige o status de objetos legados do Webjetos:
 * - Objetos com "roubo", "furtado", "roubado" no título → status = 'stolen'
 * - Objetos com "achado", "encontrado" no título → status = 'found'
 * - Objetos muito antigos (> 3 anos sem atualização) → is_public = false
 */
export async function POST(req: NextRequest) {
  let authorized = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) authorized = true;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const results: Record<string, number> = {};

  try {
    // ── 1. Corrigir status para 'stolen' ─────────────────────────────────────
    const stolenRes = await query(`
      UPDATE objects SET status = 'stolen', updated_at = NOW()
      WHERE is_legacy = true AND status = 'lost'
        AND (
          title ILIKE '%roubo%' OR title ILIKE '%roubado%' OR title ILIKE '%roubada%'
          OR title ILIKE '%furtado%' OR title ILIKE '%furtada%' OR title ILIKE '%furto%'
          OR title ILIKE '%assalto%' OR title ILIKE '%assaltado%' OR title ILIKE '%assaltada%'
          OR title ILIKE '%subtraído%' OR title ILIKE '%subtraída%'
          OR title ILIKE '%desvio de carga%' OR title ILIKE '%roubo de carga%'
          OR title ILIKE '%carga roubada%' OR title ILIKE '%carga furtada%'
        )
    `);
    results.stolen = stolenRes.rowCount ?? 0;

    // ── 2. Corrigir status para 'found' ──────────────────────────────────────
    const foundRes = await query(`
      UPDATE objects SET status = 'found', updated_at = NOW()
      WHERE is_legacy = true AND status = 'lost'
        AND (
          title ILIKE '%achado%' OR title ILIKE '%achada%'
          OR title ILIKE '%encontrado%' OR title ILIKE '%encontrada%'
          OR title ILIKE '%procura-se dono%' OR title ILIKE '%procuro dono%'
          OR title ILIKE '%dono desconhecido%'
        )
    `);
    results.found = foundRes.rowCount ?? 0;

    // ── 3. Arquivar objetos muito antigos sem foto (> 4 anos) ─────────────────
    // Apenas objetos legados sem imagem e sem atualização recente
    const archivedRes = await query(`
      UPDATE objects SET is_public = false, updated_at = NOW()
      WHERE is_legacy = true
        AND status = 'lost'
        AND created_at < NOW() - INTERVAL '4 years'
        AND (images IS NULL OR images = '[]' OR images = 'null')
        AND is_public = true
    `);
    results.archived = archivedRes.rowCount ?? 0;

    return NextResponse.json({
      success: true,
      results,
      total_updated: Object.values(results).reduce((a, b) => a + b, 0),
      message: `Migração concluída: ${results.stolen} → stolen, ${results.found} → found, ${results.archived} arquivados`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
