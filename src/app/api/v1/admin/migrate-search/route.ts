import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/adminGuard';

export const maxDuration = 30;

export async function POST(request: Request) {
  const guard = await requireAdmin(request as import('next/server').NextRequest);
  if (guard instanceof NextResponse) return guard;

  const steps: string[] = [];
  const errors: string[] = [];

  async function run(label: string, sql: string) {
    try {
      await query(sql);
      steps.push(`✓ ${label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`✗ ${label}: ${msg}`);
    }
  }

  // ─── 1. Índices simples essenciais ───────────────────────────────────────
  await run(
    'idx_objects_status',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_status ON objects(status)`
  );
  await run(
    'idx_objects_category',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_category ON objects(category)`
  );
  await run(
    'idx_objects_created_at',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_created_at ON objects(created_at DESC)`
  );
  await run(
    'idx_objects_updated_at',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_updated_at ON objects(updated_at DESC)`
  );
  await run(
    'idx_objects_is_public',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_is_public ON objects(is_public)`
  );
  await run(
    'idx_objects_user_id',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_user_id ON objects(user_id)`
  );
  await run(
    'idx_objects_qr_code',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_qr_code ON objects(qr_code)`
  );

  // ─── 2. Índices compostos para os filtros mais comuns ────────────────────
  // Busca pública: is_public + status + category + updated_at
  await run(
    'idx_objects_public_search',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_public_search
     ON objects(is_public, status, category, updated_at DESC)`
  );

  // Busca pública com boost: is_public + status + is_boosted + updated_at
  await run(
    'idx_objects_public_boosted',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_public_boosted
     ON objects(is_public, is_boosted DESC, updated_at DESC)
     WHERE status IN ('lost', 'found', 'stolen')`
  );

  // Admin: status + category + updated_at (sem filtro is_public)
  await run(
    'idx_objects_admin_search',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_admin_search
     ON objects(status, category, updated_at DESC)`
  );

  // Matching: status + category (para busca de candidatos a match)
  await run(
    'idx_objects_matching',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_matching
     ON objects(status, category, created_at DESC)
     WHERE status IN ('lost', 'found')`
  );

  // Coordenadas geográficas (para busca por proximidade)
  await run(
    'idx_objects_geo',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_geo
     ON objects(latitude, longitude)
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
  );

  // ─── 3. Full-Text Search (tsvector) ──────────────────────────────────────
  // Adicionar coluna search_vector se não existir
  await run(
    'ADD COLUMN search_vector',
    `ALTER TABLE objects ADD COLUMN IF NOT EXISTS search_vector tsvector`
  );

  // Preencher search_vector para todos os registros existentes
  // Pesos: A = título (maior), B = marca/raça/cor, C = descrição/localização
  await run(
    'POPULATE search_vector (todos os registros)',
    `UPDATE objects SET search_vector =
      setweight(to_tsvector('portuguese', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('portuguese', COALESCE(brand, '')), 'B') ||
      setweight(to_tsvector('portuguese', COALESCE(breed, '')), 'B') ||
      setweight(to_tsvector('portuguese', COALESCE(color, '')), 'B') ||
      setweight(to_tsvector('portuguese', COALESCE(description, '')), 'C') ||
      setweight(to_tsvector('portuguese', COALESCE(location, '')), 'C')
    WHERE search_vector IS NULL`
  );

  // Índice GIN para full-text search
  await run(
    'idx_objects_fts (GIN)',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_fts
     ON objects USING GIN(search_vector)`
  );

  // ─── 4. Trigger para manter search_vector atualizado automaticamente ─────
  await run(
    'FUNCTION update_objects_search_vector',
    `CREATE OR REPLACE FUNCTION update_objects_search_vector()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.search_vector :=
         setweight(to_tsvector('portuguese', COALESCE(NEW.title, '')), 'A') ||
         setweight(to_tsvector('portuguese', COALESCE(NEW.brand, '')), 'B') ||
         setweight(to_tsvector('portuguese', COALESCE(NEW.breed, '')), 'B') ||
         setweight(to_tsvector('portuguese', COALESCE(NEW.color, '')), 'B') ||
         setweight(to_tsvector('portuguese', COALESCE(NEW.description, '')), 'C') ||
         setweight(to_tsvector('portuguese', COALESCE(NEW.location, '')), 'C');
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql`
  );

  await run(
    'TRIGGER trig_objects_search_vector',
    `DROP TRIGGER IF EXISTS trig_objects_search_vector ON objects;
     CREATE TRIGGER trig_objects_search_vector
     BEFORE INSERT OR UPDATE OF title, brand, breed, color, description, location
     ON objects
     FOR EACH ROW EXECUTE FUNCTION update_objects_search_vector()`
  );

  // ─── 5. Índice pg_trgm para busca por similaridade (typo-tolerant) ───────
  await run(
    'EXTENSION pg_trgm',
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  );

  await run(
    'idx_objects_title_trgm (trigram)',
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_objects_title_trgm
     ON objects USING GIN(title gin_trgm_ops)`
  );

  return NextResponse.json({
    ok: errors.length === 0,
    steps,
    errors,
    summary: `${steps.length} etapas concluídas, ${errors.length} erros`,
  });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request as import('next/server').NextRequest);
  if (guard instanceof NextResponse) return guard;

  // Verificar quais índices já existem
  const result = await query(`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE tablename = 'objects'
    ORDER BY indexname
  `);

  const hasSearchVector = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'objects' AND column_name = 'search_vector'
  `);

  const hasTrigger = await query(`
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'objects' AND trigger_name = 'trig_objects_search_vector'
  `);

  return NextResponse.json({
    indexes: result.rows,
    has_search_vector: hasSearchVector.rows.length > 0,
    has_trigger: hasTrigger.rows.length > 0,
    total_indexes: result.rows.length,
  });
}
