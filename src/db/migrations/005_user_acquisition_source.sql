-- ============================================================
-- BACKFINDR — Migration 005
-- Origem de aquisição do usuário: UTM + referrer na primeira visita
-- Idempotente — pode ser executada múltiplas vezes
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utm_source    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_medium    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_campaign  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_content   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS utm_term      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS referrer      TEXT,
  ADD COLUMN IF NOT EXISTS landing_page  TEXT;

CREATE INDEX IF NOT EXISTS idx_users_utm_source ON users(utm_source);

-- Comentários
COMMENT ON COLUMN users.utm_source   IS 'Origem da primeira visita (ex: google, instagram, facebook)';
COMMENT ON COLUMN users.utm_medium   IS 'Meio da primeira visita (ex: cpc, social, organic)';
COMMENT ON COLUMN users.utm_campaign IS 'Nome da campanha de marketing da primeira visita';
COMMENT ON COLUMN users.utm_content  IS 'Conteúdo/variante do anúncio da primeira visita';
COMMENT ON COLUMN users.utm_term     IS 'Termo de busca pago da primeira visita';
COMMENT ON COLUMN users.referrer     IS 'URL completa de referência (document.referrer) da primeira visita';
COMMENT ON COLUMN users.landing_page IS 'Primeira página visitada (path) antes do cadastro';
