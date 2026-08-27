-- Migration 015 -- coluna region_hint em public_signal_evidence (27/08/2026)
--
-- Achado real: "Cachorro encontrado no bairro Parque Verde" (fonte CGN,
-- regiao fixa "Cascavel, PR") foi geocodificado para o bairro homonimo de
-- Belem-PA, porque o location_text extraido pela LLM veio so como "Parque
-- Verde", sem a regiao -- apesar do prompt em extract.ts instruir a LLM a
-- completar isso. O Source.regionHint (sources.ts) e conhecido, fixo e
-- 100% confiavel desde a ingestao, mas ate agora so era usado para montar o
-- prompt da LLM e descartado em seguida -- nunca persistido, entao na hora
-- de aprovar/geocodificar (dias ou semanas depois) nao havia mais nenhum
-- backstop determinístico contra a LLM ter esquecido de incluir a regiao no
-- texto. Esta coluna guarda esse valor para uso em admin/public-signals/
-- route.ts (geocode()) como garantia de regiao na query e validacao do
-- resultado do Mapbox, independente do que a LLM escreveu.
--
-- NULL = evidencia de fonte sem regiao fixa (ex: press_rss, nacional) ou
-- ingerida antes desta migration -- geocode() trata como "sem viés
-- conhecido", mesmo comportamento de hoje.
--
-- IF NOT EXISTS: idempotente, seguro rodar mesmo se a coluna ja existir.

ALTER TABLE public_signal_evidence
  ADD COLUMN IF NOT EXISTS region_hint TEXT;

COMMENT ON COLUMN public_signal_evidence.region_hint IS
  'Regiao fixa da fonte (Source.regionHint em sources.ts, ex: "Cascavel, PR"), persistida no momento da ingestao para uso como backstop deterministico na geocodificacao em admin/public-signals/route.ts. NULL = fonte nacional/sem viés geografico, ou evidencia anterior a esta migration.';
