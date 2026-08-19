-- ============================================================
-- BACKFINDR — Migration 008
-- Public Signals — fecha o gap de atomicidade no dedup identificado em
-- 19/08/2026: o pipeline de ingestão fazia SELECT (checar dedup_hash)
-- seguido de INSERT, sem garantia atômica — duas execuções sobrepostas do
-- cron poderiam inserir a mesma ocorrência duas vezes. Risco baixo com
-- cadência 1x/dia, mas registrado como bloqueante antes de ligar o cron
-- (ver docs/PENDENCIAS.md).
-- Idempotente — pode ser executada múltiplas vezes.
-- ============================================================

-- Antes de aplicar a constraint, confirmar que não existe duplicata
-- histórica de dedup_hash na tabela (esperado: 0 linhas, já que a tabela é
-- nova e o dedup fino já rejeitava duplicata explícita — mas checar de
-- verdade em vez de assumir):
--
--   SELECT dedup_hash, COUNT(*) FROM public_signal_evidence
--   WHERE dedup_hash IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
--
-- Se essa query não retornar linha nenhuma, a ALTER TABLE abaixo é segura.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_public_signal_evidence_dedup_hash'
  ) THEN
    ALTER TABLE public_signal_evidence
      ADD CONSTRAINT uq_public_signal_evidence_dedup_hash UNIQUE (dedup_hash);
  END IF;
END $$;

COMMENT ON CONSTRAINT uq_public_signal_evidence_dedup_hash ON public_signal_evidence IS
  'Garante atomicidade do dedup fino entre execuções sobrepostas do cron — Postgres trata múltiplos NULL como não-conflitantes entre si, então linhas sem hash calculado não são afetadas. Usar com INSERT ... ON CONFLICT (dedup_hash) DO NOTHING no código, não só confiar no SELECT prévio.';
