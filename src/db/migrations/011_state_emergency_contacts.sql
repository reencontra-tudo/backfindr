-- ============================================================
-- BACKFINDR — Migration 011
-- state_emergency_contacts (enriquecimento adicional às páginas de
-- achados-perdidos por cidade — não substitui nem se mistura com
-- municipalities.police_contact, que é uma tabela e uma pesquisa
-- diferentes, com fonte diferente)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: municipalities já tem state_code (ex: 'SP', 'RJ') — essa
-- tabela guarda 1 linha por UF (27: 26 estados + DF), populada a partir
-- da página oficial "Telefones Úteis" do portal de governo de cada
-- estado. A página de cidade busca o registro pelo state_code do
-- município — não duplica o dado por cidade, é lookup direto.
--
-- phones é um array JSONB de objetos {label, phone, source_url} —
-- vários números úteis por estado (Polícia Militar, Bombeiros, SAMU,
-- Defesa Civil, Detran, Polícia Civil, Procon, etc.), cada um com sua
-- própria proveniência (mesma disciplina já usada em
-- police_contact_source_url — nunca um número sem fonte rastreável).
-- ============================================================

CREATE TABLE IF NOT EXISTS state_emergency_contacts (
  state_code    CHAR(2) PRIMARY KEY,
  state_name    TEXT NOT NULL,
  phones        JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url    TEXT,          -- página oficial "Telefones Úteis" usada como fonte principal desta UF
  last_updated_at TIMESTAMPTZ,
  notes         TEXT
);

COMMENT ON TABLE state_emergency_contacts IS
  'Telefones úteis por estado (27 linhas: 26 UFs + DF), enriquecimento adicional às páginas de achados-perdidos. Lookup por state_code do município, não duplicado por cidade. Fonte: página oficial "Telefones Úteis" do portal de governo de cada estado.';
COMMENT ON COLUMN state_emergency_contacts.phones IS
  'Array JSONB de {label, phone, source_url}. Cada telefone carrega sua própria fonte — mesma disciplina de proveniência de municipalities.police_contact_source_url. Nunca popular um telefone sem source_url correspondente.';
COMMENT ON COLUMN state_emergency_contacts.source_url IS
  'URL da página oficial "Telefones Úteis" (ou equivalente) do portal do estado, usada como fonte principal. Telefones individuais podem ter source_url próprio em phones[].source_url quando vierem de uma página diferente dentro do mesmo domínio oficial.';
