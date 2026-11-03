-- Migration 023 -- preferências de aviso por evento e canal (Fase 0, item 4)
--
-- NÃO APLICADA: entregue no PR, para autorização antes de rodar no SQL Editor.
--
-- Guarda só o que o usuário mudou. Sem linha = ligado (comportamento de hoje), então a tabela
-- começa vazia e nada muda para quem nunca mexeu. O código também funciona sem esta tabela
-- (ausência é tratada como "tudo ligado").
--
-- Eventos configuráveis: match, qr_scan, chat_message, returned. E-mail de segurança NÃO é um
-- evento desta tabela e nunca é desligável por ela. Canais previstos: app, push, email; hoje só
-- o canal push é respeitado nos pontos de envio.
--
-- RLS ligado e NENHUMA policy; grants de anon/authenticated revogados (a aplicação usa a
-- conexão direta do servidor). Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('match', 'qr_scan', 'chat_message', 'returned')),
  channel TEXT NOT NULL CHECK (channel IN ('app', 'push', 'email')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event, channel)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE notification_preferences FROM anon, authenticated;

-- Verificação após aplicar (somente leitura):
--   select relrowsecurity from pg_class where relname = 'notification_preferences';   -- esperado: true
--   select has_table_privilege('anon', 'notification_preferences', 'SELECT'),
--          has_table_privilege('authenticated', 'notification_preferences', 'SELECT'); -- esperado: false, false
--   select count(*) from notification_preferences;                                    -- esperado: 0
--
-- Reversão (a tabela é nova e só guarda preferências; ao removê-la tudo volta a "ligado"):
--   DROP TABLE notification_preferences;
