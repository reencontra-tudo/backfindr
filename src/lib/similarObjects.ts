// ─── Aviso de objeto parecido (POST /api/v1/objects) ─────────────────────────
// Procura, entre os objetos do PRÓPRIO usuário e na MESMA categoria, algum que
// pareça com o que está sendo registrado. É só um aviso: quem decide é o
// usuário (confirm_duplicate: true cria mesmo assim). Nunca vira constraint.
//
// Parecido = descrição igual (trim + minúsculas, não vazia) OU
//            similarity(título) >= SIMILAR_TITLE_THRESHOLD (pg_trgm).
// O pg_trgm já ignora maiúsculas/minúsculas e pontuação ao montar os trigramas.

export const SIMILAR_OBJECT_ERROR = 'SIMILAR_OBJECT_FOUND';
export const SIMILAR_TITLE_THRESHOLD = 0.6;
export const SIMILAR_MAX_RESULTS = 3;

export interface SimilarObject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[] }>;

export function normalizeDescription(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function findSimilarObjects(
  queryFn: QueryFn,
  input: { userId: string; category: string; title: string; description?: unknown },
): Promise<SimilarObject[]> {
  const description = normalizeDescription(input.description);

  // Sempre filtrado por user_id (índice idx_objects_user_id): nunca expõe objetos
  // de outros usuários. similarity() em WHERE não usa o GIN idx_objects_title_trgm,
  // mas o conjunto já vem reduzido ao dono do objeto.
  const result = await queryFn(
    `SELECT id, title, description, status, created_at
       FROM objects
      WHERE user_id = $1
        AND category = $2
        AND status != 'deleted'
        AND (
          ($3 <> '' AND lower(btrim(description, E' \\t\\r\\n')) = $3)
          OR similarity(title, $4) >= $5
        )
      ORDER BY created_at DESC
      LIMIT $6`,
    [input.userId, input.category, description, input.title.trim(), SIMILAR_TITLE_THRESHOLD, SIMILAR_MAX_RESULTS],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}
