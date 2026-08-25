export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';
import { buildPublicSignalDescription, LEGACY_GENERIC_DESCRIPTION_PREFIX } from '@/lib/publicSignals/description';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || '';

/**
 * POST /api/v1/admin/fix-legacy-public-signal-descriptions
 * Corrige objects criados via Public Signals (source='public_signal') que
 * ficaram com a description genérica antiga ("Ocorrência identificada
 * automaticamente a partir de fonte pública. Fonte: <url>", idêntica pra
 * TODOS os objetos, só variando a URL). Busca extracted_fields/source_type
 * em public_signal_evidence (via object_id) e recalcula uma description
 * específica por objeto com buildPublicSignalDescription — mesma função
 * agora usada pela rota de aprovação pra objetos novos.
 *
 * Não usa raw_description (ver comentário em lib/publicSignals/description.ts
 * pro porquê: pode conter PII de contato ou HTML cru/truncado).
 *
 * Auth: aceita sessão de admin já logada (cookie access_token, mesmo guard
 * do resto do painel) OU MIGRATION_SECRET no body — mesmo padrão de
 * fix-legacy-status/route.ts, com o cookie como atalho pra execução manual
 * via painel sem precisar manusear o secret.
 */
export async function POST(req: NextRequest) {
  const adminAuth = await requireAdmin(req);
  let authorized = !(adminAuth instanceof NextResponse);
  if (!authorized) {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      if (MIGRATION_SECRET && body.secret === MIGRATION_SECRET) authorized = true;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const rowsRes = await query(
      `SELECT o.id AS object_id, e.extracted_fields, e.source_url, e.source_type
         FROM objects o
         JOIN public_signal_evidence e ON e.object_id = o.id
        WHERE o.source = 'public_signal'
          AND o.description LIKE $1`,
      [`${LEGACY_GENERIC_DESCRIPTION_PREFIX}%`]
    );

    let updated = 0;
    const skipped: string[] = [];

    for (const row of rowsRes.rows) {
      const fields = row.extracted_fields as
        | { title?: string; category?: string; location_text?: string | null }
        | null;
      if (!fields?.title) {
        skipped.push(row.object_id);
        continue;
      }
      const newDescription = buildPublicSignalDescription(fields, row.source_url, row.source_type);
      await query(`UPDATE objects SET description = $1, updated_at = NOW() WHERE id = $2`, [
        newDescription,
        row.object_id,
      ]);
      updated++;
    }

    return NextResponse.json({
      success: true,
      total_found: rowsRes.rows.length,
      updated,
      skipped_no_extracted_fields: skipped,
      message: `${updated} de ${rowsRes.rows.length} objetos com description genérica corrigidos.`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
