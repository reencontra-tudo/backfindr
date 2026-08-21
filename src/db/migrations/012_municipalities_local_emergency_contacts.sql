-- ============================================================
-- BACKFINDR — Migration 012
-- emergency_contacts_local em municipalities (enriquecimento local,
-- complementar a state_emergency_contacts — não substitui, não mistura)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: state_emergency_contacts (migration 011) cobre telefones
-- úteis por UF. Esta migração adiciona a contraparte MUNICIPAL: quando
-- a prefeitura da própria cidade tem uma página "Telefones Úteis" (ou
-- equivalente) ativa no domínio oficial (padrão comum:
-- [cidade].[uf].gov.br/paginas/telefones-uteis ou variação), essa fonte
-- é mais específica e local do que o registro estadual, e é usada como
-- fonte primária na página da cidade.
--
-- Regra de composição (aplicada na camada de página, não no banco):
-- 1. Mostrar os itens de emergency_contacts_local primeiro (mais
--    específicos: guarda municipal, defesa civil municipal, ouvidoria
--    da prefeitura, etc.)
-- 2. Complementar com itens de state_emergency_contacts (lookup por
--    municipalities.state_code) que sejam de natureza estadual (PM,
--    Bombeiros, SAMU, Polícia Civil) e cujo telefone ainda não apareça
--    na lista local — evita duplicar o mesmo número duas vezes.
-- 3. Se emergency_contacts_local for NULL, a página usa só o registro
--    estadual (comportamento atual, sem mudança).
--
-- emergency_contacts_local é um array JSONB de objetos
-- {label, phone, source_url} — mesmo formato de state_emergency_contacts
-- .phones, mesma disciplina de proveniência (nunca um telefone sem
-- source_url correspondente).
-- ============================================================

ALTER TABLE municipalities
  ADD COLUMN IF NOT EXISTS emergency_contacts_local JSONB,
  ADD COLUMN IF NOT EXISTS emergency_contacts_local_source_url TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contacts_local_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emergency_contacts_local_notes TEXT;

COMMENT ON COLUMN municipalities.emergency_contacts_local IS
  'Array JSONB de {label, phone, source_url} — telefones úteis da própria PREFEITURA do município (fonte local, mais específica que state_emergency_contacts). NULL quando a prefeitura não tem página "Telefones Úteis" ativa no domínio oficial — ausência é esperada, não é erro. Nunca populado com fonte de terceiro/agregador.';
COMMENT ON COLUMN municipalities.emergency_contacts_local_source_url IS
  'URL da página oficial "Telefones Úteis" (ou equivalente) da prefeitura, usada como fonte principal deste município. Itens individuais podem ter source_url próprio em emergency_contacts_local[].source_url quando vierem de uma página diferente dentro do mesmo domínio oficial.';
COMMENT ON COLUMN municipalities.emergency_contacts_local_notes IS
  'Motivo de ausência de fonte (página não encontrada, domínio quebrado, etc.) ou observações de desambiguação, mesmo padrão já usado em police_contact_notes.';
