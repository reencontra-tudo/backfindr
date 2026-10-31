-- Migration 021 -- mensagens e eventos de e-mail (31/10/2026)
--
-- NÃO APLICADA: entregue no PR, para o Marcos aplicar no SQL Editor.
-- Depende de: 020 não é exigida, mas email_campaigns e users devem existir.
--
-- email_messages: uma linha por e-mail aceito pelo Resend (resend_id único). O destinatário
--   fica só como HMAC-SHA256 (to_email_hash); o corpo do e-mail nunca é gravado.
-- email_events: eventos devolvidos pelo webhook do Resend (delivered, bounced, complained,
--   delivery_delayed, opened, clicked). payload só tem campos permitidos (sem endereço, sem
--   assunto, sem link, sem mensagem de erro do servidor de destino).
-- email_campaigns.skipped_count: envios recusados pela regra canSendEmail (não são falha).
--
-- RLS ligado e NENHUMA policy; grants de anon/authenticated revogados. Idempotente.

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id TEXT NOT NULL UNIQUE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  to_email_hash TEXT NULL,
  category TEXT NOT NULL CHECK (category IN ('security', 'service', 'marketing')),
  source TEXT NOT NULL,
  campaign_id UUID NULL REFERENCES email_campaigns(id) ON DELETE SET NULL,
  lifecycle_event TEXT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_campaign ON email_messages (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages (sent_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages (user_id);

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id TEXT NOT NULL,
  type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resend_id, type, occurred_at)
);

CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events (resend_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type_time ON email_events (type, occurred_at);

ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE email_messages FROM anon, authenticated;
REVOKE ALL ON TABLE email_events FROM anon, authenticated;

COMMENT ON TABLE email_messages IS
  'E-mails aceitos pelo Resend. Destinatário só em hash (HMAC). Retenção a definir.';
COMMENT ON TABLE email_events IS
  'Eventos do webhook do Resend, sem endereço, assunto, link nem corpo. Idempotente por (resend_id, type, occurred_at).';

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select relname, relrowsecurity from pg_class
--    where relname in ('email_messages','email_events');                -- esperado: true
--   select column_name from information_schema.columns
--    where table_name = 'email_campaigns' and column_name = 'skipped_count';   -- esperado: 1 linha
--
-- COMO DESFAZER (só com ordem expressa; apaga dados):
--   DROP TABLE email_events; DROP TABLE email_messages;
--   ALTER TABLE email_campaigns DROP COLUMN skipped_count;
-- ============================================================
