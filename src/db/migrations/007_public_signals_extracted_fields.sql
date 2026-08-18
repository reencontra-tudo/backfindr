-- ============================================================
-- BACKFINDR — Migration 007
-- Public Signals — corrige gap da migration 006: faltava onde guardar
-- os campos extraídos (título/categoria/status/local) no caso comum,
-- que é has_contact_data=false. contact_snapshot continua existindo só
-- para o dado sensível (texto de contato), não para o resto.
-- Idempotente — pode ser executada múltiplas vezes.
-- ============================================================

ALTER TABLE public_signal_evidence
  ADD COLUMN IF NOT EXISTS extracted_fields JSONB;

COMMENT ON COLUMN public_signal_evidence.extracted_fields IS
  'Campos estruturados da extração (title, category, status_guess, location_text, confidence_score) — sempre presente, independente de has_contact_data. Não confundir com contact_snapshot, que só existe pro dado sensível de contato.';
