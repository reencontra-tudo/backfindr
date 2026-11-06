-- Migration 020 -- supressão e preferências de e-mail (31/10/2026)
--
-- NÃO APLICADA: entregue no PR, para o Marcos aplicar no SQL Editor.
--
-- email_suppressions: endereços que não devem receber e-mail (descadastro, bounce
--   permanente, reclamação, ação manual). O endereço NUNCA é gravado em texto puro:
--   email_hash = HMAC-SHA256(EMAIL_HASH_SECRET, e-mail em minúsculas, sem espaços).
-- email_preferences: opt-in de marketing por usuário. A estrutura fica pronta; nada na
--   aplicação grava opt_in = true ainda (falta a tela de consentimento e a política).
--
-- RLS ligado e NENHUMA policy; grants de anon/authenticated revogados (a aplicação usa a
-- conexão direta do servidor). Idempotente.

CREATE TABLE IF NOT EXISTS email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL UNIQUE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_user_id ON email_suppressions (user_id);

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_at TIMESTAMPTZ NULL,
  policy_version TEXT NULL,
  source TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE email_suppressions FROM anon, authenticated;
REVOKE ALL ON TABLE email_preferences FROM anon, authenticated;

COMMENT ON TABLE email_suppressions IS
  'Endereços suprimidos (hash HMAC, nunca texto puro). Dado pessoal (LGPD) em forma embaralhada. Motivos: unsubscribe, bounce, complaint, manual.';
COMMENT ON TABLE email_preferences IS
  'Preferências de e-mail por usuário. marketing_opt_in = consentimento explícito para marketing (padrão: false).';

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select relname, relrowsecurity from pg_class
--    where relname in ('email_suppressions','email_preferences');        -- esperado: relrowsecurity = true
--   select has_table_privilege('anon', 'email_suppressions', 'SELECT'),
--          has_table_privilege('authenticated', 'email_preferences', 'SELECT');   -- esperado: false, false
--
-- COMO DESFAZER (só com ordem expressa; apaga dados):
--   DROP TABLE email_preferences; DROP TABLE email_suppressions;
-- ============================================================
