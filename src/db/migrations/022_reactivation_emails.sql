-- Migration 022 -- tabela reactivation_emails (31/10/2026)
--
-- NÃO APLICADA: entregue no PR, para o Marcos aplicar no SQL Editor.
--
-- src/app/api/v1/cron/reactivation/route.ts consulta e grava esta tabela
-- (NOT EXISTS por object_id e INSERT ... ON CONFLICT (object_id)), mas ela nunca foi
-- criada no banco: a rota cai no catch e devolve 500. Esta migration cria exatamente as
-- colunas que o código usa. Criar a tabela não reativa o cron: quem o dispara é externo, e
-- e-mail de reativação agora é categoria 'marketing' (exige opt-in registrado).
--
-- RLS ligado e NENHUMA policy; grants de anon/authenticated revogados. Idempotente.

CREATE TABLE IF NOT EXISTS reactivation_emails (
  object_id UUID PRIMARY KEY REFERENCES objects(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactivation_emails_sent_at ON reactivation_emails (sent_at);

ALTER TABLE reactivation_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE reactivation_emails FROM anon, authenticated;

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select relname, relrowsecurity from pg_class where relname = 'reactivation_emails';   -- esperado: true
--
-- COMO DESFAZER (só com ordem expressa): DROP TABLE reactivation_emails;
-- ============================================================
