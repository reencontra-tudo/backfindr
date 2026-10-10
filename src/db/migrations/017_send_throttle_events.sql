-- Migration 017 -- tabela send_throttle_events (09/10/2026)
--
-- Controle genérico de LIMITE DE ENVIOS (e-mail e afins). Uma linha por envio
-- permitido, identificada por TIPO de envio (kind) e por uma CHAVE EMBARALHADA
-- (key_hash). Serve para consultar "quantos envios deste tipo, para esta chave,
-- nos últimos N segundos" e recusar o envio acima do limite, sem recusar a
-- operação principal (ex.: o cadastro continua normal; só o e-mail não sai).
--
-- Primeiro uso: boas-vindas no cadastro (kind = 'welcome_ip', limite de 5 por
-- origem em 24 h). Pensada para ser reutilizada por outros envios.
--
-- key_hash NUNCA guarda o identificador original: é HMAC-SHA256 com segredo de
-- ambiente (SEND_THROTTLE_SECRET). Tratar a tabela como dado pessoal (LGPD):
-- as linhas só servem durante a janela do tipo e são removidas pela própria
-- aplicação (remoção oportunista de linhas antigas).
--
-- RLS ligado e NENHUMA policy: ninguém lê pela API pública do banco; a aplicação
-- usa a conexão direta do servidor.
--
-- IF NOT EXISTS: idempotente, seguro rodar mesmo se a tabela já existir.

CREATE TABLE IF NOT EXISTS send_throttle_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consulta por tipo + chave + janela de tempo.
CREATE INDEX IF NOT EXISTS idx_send_throttle_events_lookup
  ON send_throttle_events (kind, key_hash, created_at DESC);

-- Remoção de linhas antigas.
CREATE INDEX IF NOT EXISTS idx_send_throttle_events_created_at
  ON send_throttle_events (created_at);

ALTER TABLE send_throttle_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE send_throttle_events IS
  'Controle de limite de envios por tipo (kind) e chave embaralhada (key_hash). Dado pessoal (LGPD) em forma embaralhada; retenção = janela do tipo, limpeza oportunista feita pela aplicação.';
COMMENT ON COLUMN send_throttle_events.kind IS
  'Tipo do envio, ex.: welcome_ip. Sem enum de propósito: novos tipos não exigem migration.';
COMMENT ON COLUMN send_throttle_events.key_hash IS
  'HMAC-SHA256 (hex) do identificador, com segredo de ambiente. Nunca o valor original.';

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select to_regclass('public.send_throttle_events');                      -- esperado: send_throttle_events
--   select relrowsecurity from pg_class where oid = 'public.send_throttle_events'::regclass;   -- esperado: true
--   select count(*) from pg_policies where tablename = 'send_throttle_events';                 -- esperado: 0
--   select indexname from pg_indexes where tablename = 'send_throttle_events' order by 1;
--     -- esperado: idx_send_throttle_events_created_at, idx_send_throttle_events_lookup, send_throttle_events_pkey
--   select column_name, data_type, is_nullable from information_schema.columns
--     where table_name = 'send_throttle_events' order by ordinal_position;   -- id, kind, key_hash, created_at
--   select count(*) from send_throttle_events;                               -- esperado: 0 (sem dados iniciais)
--
-- COMO DESFAZER (apaga só esta tabela de controle; nada do app depende dela):
--   DROP TABLE IF EXISTS send_throttle_events;
-- ============================================================
