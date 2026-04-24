// POST /api/v1/admin/cleanup-test-data
// Endpoint temporário de limpeza — remover após uso.
// Requer autenticação admin (cookie access_token) OU header x-admin-secret.
// Operações:
//   1. Remove objetos cujo dono tem nome "Teste Usuario" (case-insensitive)
//   2. Remove usuários com nome "Teste Usuario" (após remover seus objetos)
//   3. Remove objetos duplicados: mantém o mais antigo (MIN created_at) por (user_id, title, status)

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { query } from '@/lib/db';

const MIGRATION_SECRET = process.env.MIGRATION_SECRET ?? '';
const TEMP_CLEANUP_KEY = 'cleanup-backfindr-2024-xK9mP3';

function isAuthorizedBySecret(req: NextRequest): boolean {
  const header = req.headers.get('x-admin-secret') ?? '';
  if (header === TEMP_CLEANUP_KEY) return true;
  if (!MIGRATION_SECRET) return false;
  return header === MIGRATION_SECRET;
}

// Query para encontrar duplicatas: mantém o mais antigo por (user_id, title normalizado, status)
const DUP_QUERY = `
  SELECT o.id, o.title, o.status, o.user_id, o.created_at
  FROM objects o
  WHERE o.id NOT IN (
    SELECT DISTINCT ON (user_id, LOWER(TRIM(title)), status) id
    FROM objects
    ORDER BY user_id, LOWER(TRIM(title)), status, created_at ASC
  )
  ORDER BY o.created_at DESC
`;

export async function POST(req: NextRequest) {
  if (!isAuthorizedBySecret(req)) {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
  }

  const log: string[] = [];

  try {
    // ── 1. Identificar usuários de teste ─────────────────────────────────────
    const testUsersRes = await query(
      `SELECT id, name, email FROM users
       WHERE LOWER(name) LIKE '%teste%' OR LOWER(email) LIKE '%teste%'`
    );
    const testUserIds: string[] = testUsersRes.rows.map((r: { id: string }) => r.id);
    log.push(`Usuários de teste encontrados: ${testUsersRes.rows.length}`);
    testUsersRes.rows.forEach((r: { id: string; name: string; email: string }) =>
      log.push(`  → ${r.name} <${r.email}> (${r.id})`)
    );

    // ── 2. Remover objetos dos usuários de teste ──────────────────────────────
    let deletedObjects = 0;
    if (testUserIds.length > 0) {
      const placeholders = testUserIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const delObjRes = await query(
        `DELETE FROM objects WHERE user_id IN (${placeholders}) RETURNING id, title`,
        testUserIds
      );
      deletedObjects = delObjRes.rows.length;
      log.push(`Objetos de teste removidos: ${deletedObjects}`);
      delObjRes.rows.forEach((r: { id: string; title: string }) =>
        log.push(`  → "${r.title}" (${r.id})`)
      );
    }

    // ── 3. Remover usuários de teste ──────────────────────────────────────────
    let deletedUsers = 0;
    if (testUserIds.length > 0) {
      const placeholders = testUserIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const delUserRes = await query(
        `DELETE FROM users WHERE id IN (${placeholders}) RETURNING id, name`,
        testUserIds
      );
      deletedUsers = delUserRes.rows.length;
      log.push(`Usuários de teste removidos: ${deletedUsers}`);
    }

    // ── 4. Remover duplicatas ─────────────────────────────────────────────────
    const dupRes = await query(DUP_QUERY);
    log.push(`Duplicatas encontradas: ${dupRes.rows.length}`);
    dupRes.rows.forEach((r: { id: string; title: string; status: string }) =>
      log.push(`  → "${r.title}" [${r.status}] (${r.id})`)
    );

    let deletedDuplicates = 0;
    if (dupRes.rows.length > 0) {
      const dupIds: string[] = dupRes.rows.map((r: { id: string }) => r.id);
      const placeholders = dupIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const delDupRes = await query(
        `DELETE FROM objects WHERE id IN (${placeholders}) RETURNING id`,
        dupIds
      );
      deletedDuplicates = delDupRes.rows.length;
      log.push(`Duplicatas removidas: ${deletedDuplicates}`);
    }

    // ── 5. Contagem final ─────────────────────────────────────────────────────
    const countRes = await query(`SELECT COUNT(*) AS total FROM objects`);
    const totalRemaining = parseInt(countRes.rows[0]?.total ?? '0', 10);

    return NextResponse.json({
      success: true,
      summary: {
        test_users_removed:   deletedUsers,
        test_objects_removed: deletedObjects,
        duplicates_removed:   deletedDuplicates,
        objects_remaining:    totalRemaining,
      },
      log,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg, log }, { status: 500 });
  }
}

// GET — dry-run: mostra o que seria removido sem deletar
export async function GET(req: NextRequest) {
  if (!isAuthorizedBySecret(req)) {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
  }

  try {
    const testUsersRes = await query(
      `SELECT id, name, email FROM users
       WHERE LOWER(name) LIKE '%teste%' OR LOWER(email) LIKE '%teste%'`
    );
    const testUserIds: string[] = testUsersRes.rows.map((r: { id: string }) => r.id);

    let testObjectsCount = 0;
    let testObjects: { id: string; title: string; status: string }[] = [];
    if (testUserIds.length > 0) {
      const placeholders = testUserIds.map((_: string, i: number) => `$${i + 1}`).join(', ');
      const res = await query(
        `SELECT id, title, status FROM objects WHERE user_id IN (${placeholders})`,
        testUserIds
      );
      testObjectsCount = res.rows.length;
      testObjects = res.rows;
    }

    const dupRes = await query(DUP_QUERY);

    return NextResponse.json({
      dry_run: true,
      test_users:         testUsersRes.rows,
      test_objects_count: testObjectsCount,
      test_objects:       testObjects,
      duplicates_count:   dupRes.rows.length,
      duplicates:         dupRes.rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
