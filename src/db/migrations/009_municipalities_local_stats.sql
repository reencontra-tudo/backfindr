-- ============================================================
-- BACKFINDR — Migration 009
-- Estatísticas reais do Backfindr por município (SEO local, Fase A/B)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: auditoria de SEO em 20/08/2026 achou que municipalities já
-- tinha latitude/longitude/total_objects_registered desenhados, mas nunca
-- populados (todos NULL/0 nas 62 cidades) — mesmo padrão de schema bem
-- desenhado e nunca terminado já visto no Public Signals (conta-âncora,
-- proveniência). Esta migration completa o desenho:
--   - radius_km: raio (km) usado na agregação Haversine de objects por
--     cidade — variável por porte de cidade (mesma lição do regionHint
--     obrigatório no Public Signals: não assumir escala igual pra lugares
--     diferentes — 20km pra São Paulo, 6km pra Salesópolis não fazem
--     sentido trocados).
--   - category_breakdown: cache da contagem de objects por categoria
--     nesta cidade (JSONB, ex: {"celular": 42, "pet": 31, ...}).
--   - last_computed_at: quando essas estatísticas foram calculadas pela
--     última vez — cache periódico, não cálculo ao vivo por request
--     (evita reintroduzir o problema de force-dynamic já identificado
--     em objects/map/route.ts).
-- ============================================================

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS radius_km NUMERIC;

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS category_breakdown JSONB;

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS last_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN municipalities.radius_km IS
  'Raio em km usado na agregação Haversine de objects por cidade (para total_objects_registered e category_breakdown). Varia por porte de cidade — ver src/app/api/v1/admin/municipalities/refresh-stats/route.ts.';
COMMENT ON COLUMN municipalities.category_breakdown IS
  'Cache de contagem de objects por categoria nesta cidade (JSONB), recalculado periodicamente — não consultar objects ao vivo por request.';
COMMENT ON COLUMN municipalities.last_computed_at IS
  'Timestamp do último recálculo de total_objects_registered/category_breakdown.';
