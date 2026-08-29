export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ─── One-off: estima o volume real do estágio 3 ANTES de rodar "Rodar
// matching" de verdade (29/08/2026) ─────────────────────────────────────
// Depois do susto dos 386 candidatos ambíguos (base do loop incluía
// objetos legado), Marcos pediu confirmação do volume real ANTES de rodar
// de novo. Supabase Studio fora do ar de novo -- mesmo padrão da rota de
// migration, MIGRATION_SECRET no corpo. Replica a MESMA lógica de
// classifyStage2 (stopwords, distância, cor) direto em SQL, só pra contar
// -- não cria nada, só SELECT. Apagar depois de reportar o número.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.MIGRATION_SECRET;
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseCount = await query(
      `SELECT count(*) FROM objects o
       WHERE o.status = 'lost' AND o.is_legacy = false
         AND NOT EXISTS (
           SELECT 1 FROM matches m
           WHERE m.lost_object_id = o.id AND m.status IN ('pending','confirmed')
         )`
    );

    const estimate = await query(
      `WITH pairs AS (
        SELECT
          l.title AS lost_title, f.title AS found_title,
          l.color AS lost_color, f.color AS found_color,
          l.brand AS lost_brand, f.brand AS found_brand,
          CASE WHEN l.latitude IS NULL OR f.latitude IS NULL THEN NULL
            ELSE 6371 * acos(LEAST(1.0,
              cos(radians(l.latitude::float)) * cos(radians(f.latitude::float)) *
              cos(radians(f.longitude::float) - radians(l.longitude::float)) +
              sin(radians(l.latitude::float)) * sin(radians(f.latitude::float))
            ))
          END AS distance_km
        FROM objects l
        JOIN objects f
          ON f.status = 'found' AND f.is_legacy = false
          AND (f.category = l.category OR f.type = l.type
               OR (l.category IN ('pet','animal') AND f.category IN ('pet','animal')))
        WHERE l.status = 'lost' AND l.is_legacy = false
          AND NOT EXISTS (
            SELECT 1 FROM matches m
            WHERE m.lost_object_id = l.id AND m.status IN ('pending','confirmed')
          )
      ),
      stage1 AS (
        SELECT * FROM pairs WHERE distance_km IS NULL OR distance_km <= 50
      ),
      scored AS (
        SELECT *,
          EXISTS (
            SELECT 1 FROM (
              SELECT unnest(string_to_array(lower(lost_title), ' ')) AS w
              INTERSECT
              SELECT unnest(string_to_array(lower(found_title), ' ')) AS w
            ) t
            WHERE length(w) > 2 AND w NOT IN (
              'bairro','categoria','local','ocorrencia','identificada','automaticamente','partir',
              'canal','institucional','fonte','nome','achados','perdidos','perdeu','perdida','perdido',
              'desapareceu','encontrado','encontrada','encontrou','roubado','roubada','sumiu','procura',
              'documento','documentos','identidade','cachorro','cachorra','gato','gata','animal','veiculo',
              'celular','bicicleta','joia','joias','roupa','roupas','eletronico','eletronicos','bolsa',
              'carteira','chave','chaves'
            )
          ) AS text_overlap,
          (CASE
            WHEN distance_km IS NULL THEN 15
            WHEN distance_km <= 2 THEN 40
            WHEN distance_km <= 10 THEN 30
            WHEN distance_km <= 25 THEN 15
            WHEN distance_km <= 50 THEN 5
            ELSE 0
          END
          + CASE WHEN lost_color IS NOT NULL AND found_color IS NOT NULL AND lower(lost_color)=lower(found_color) THEN 10 ELSE 0 END
          + CASE WHEN lost_brand IS NOT NULL AND found_brand IS NOT NULL AND lower(lost_brand)=lower(found_brand) THEN 10 ELSE 0 END
          ) AS stage2_confidence
        FROM stage1
      )
      SELECT
        count(*) AS total_stage1,
        count(*) FILTER (WHERE NOT text_overlap) AS eliminated_no_overlap,
        count(*) FILTER (WHERE text_overlap AND stage2_confidence >= 40) AS direct_match,
        count(*) FILTER (WHERE text_overlap AND stage2_confidence >= 15 AND stage2_confidence < 40) AS ambiguous_to_llm,
        count(*) FILTER (WHERE text_overlap AND stage2_confidence < 15) AS eliminated_low_confidence
      FROM scored`
    );

    return NextResponse.json({
      base_lost_objects_now: parseInt(baseCount.rows[0].count, 10),
      estimate: estimate.rows[0],
      note: 'Nao inclui eliminacao por especie (regex, dificil replicar em SQL) — numero de ambiguous pode ficar um pouco menor na pratica.',
    });
  } catch (e) {
    console.error('[estimate-matching-volume]', e);
    return NextResponse.json({ detail: 'Erro ao estimar', error: String(e) }, { status: 500 });
  }
}
