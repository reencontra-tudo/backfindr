-- ============================================================
-- BACKFINDR — Migration 010
-- Proveniência de police_contact (item B, parte crítica)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: diferente de main_landmarks (dado estético, tolera algum
-- julgamento), police_contact é dado operacional — número errado
-- publicado é pior que campo vazio (decisão já registrada em
-- BACKFINDR.md/PENDENCIAS.md). Por isso essa coluna exige a mesma
-- disciplina de proveniência já usada no Public Signals
-- (public_signal_evidence.source_url): todo telefone publicado precisa
-- de uma fonte oficial rastreável, não "confiança no modelo".
-- ============================================================

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS police_contact_source_url TEXT;

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS police_contact_notes TEXT;

COMMENT ON COLUMN municipalities.police_contact IS
  'Telefone de delegacia oficial pra contato sobre objetos perdidos/achados. NUNCA popular sem police_contact_source_url correspondente (fonte oficial: site estadual de Polícia Civil/SSP). Null é o valor seguro quando a delegacia certa não está clara na fonte oficial — nunca adivinhar.';
COMMENT ON COLUMN municipalities.police_contact_source_url IS
  'URL da página oficial (ssp.gov.br ou equivalente estadual de Polícia Civil) de onde o telefone em police_contact foi extraído. Obrigatório sempre que police_contact não for null.';
COMMENT ON COLUMN municipalities.police_contact_notes IS
  'Qual delegacia foi escolhida (nome/número da DP) e por quê, quando o município tem mais de uma opção (DP da Mulher, distritais numeradas, etc.) — decisão documentada, não implícita.';
