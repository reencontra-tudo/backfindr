-- ============================================================
-- BACKFINDR — Migration 003
-- Branding de condomínios: cor primária e campos visuais
-- Idempotente — pode ser executada múltiplas vezes
-- ============================================================

ALTER TABLE condominios
  ADD COLUMN IF NOT EXISTS cor_primaria    VARCHAR(7)   DEFAULT '#14B8A6',
  ADD COLUMN IF NOT EXISTS cor_texto       VARCHAR(7)   DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS banner_url      TEXT,
  ADD COLUMN IF NOT EXISTS mensagem_boas_vindas TEXT;

-- Comentários
COMMENT ON COLUMN condominios.cor_primaria         IS 'Cor principal em hex (#RRGGBB) usada em botões e destaques';
COMMENT ON COLUMN condominios.cor_texto            IS 'Cor do texto sobre a cor primária (#FFFFFF ou #000000)';
COMMENT ON COLUMN condominios.banner_url           IS 'Imagem de fundo ou banner da página de cadastro';
COMMENT ON COLUMN condominios.mensagem_boas_vindas IS 'Texto personalizado exibido na página de cadastro do morador';
