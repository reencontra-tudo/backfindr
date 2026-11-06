-- Migration 024 -- evento 'platform_message' em notification_preferences (Fase 1, entrega 4)
--
-- APLICADA em 04/11/2026 (pelo Marcos, no SQL Editor). Não reaplicar.
--
-- Hoje a mensagem da plataforma ao dono é SOMENTE in-app (Q-17). Esta migration só prepara o terreno
-- para um push OPCIONAL: acrescenta 'platform_message' à lista de eventos aceitos pela tabela da 023.
-- Não cria dado, não muda linhas existentes e não liga nada: o push continua desligado no código
-- (PLATFORM_MESSAGE_PUSH_ENABLED = false em src/lib/platformMessagePush.ts) até decisão do Marcos.
--
-- Idempotente: troca a constraint por uma que aceita os eventos antigos + o novo.

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_event_check;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_event_check
  CHECK (event IN ('match', 'qr_scan', 'chat_message', 'returned', 'platform_message'));

-- Verificação após aplicar (somente leitura):
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'notification_preferences'::regclass and conname = 'notification_preferences_event_check';
--   -- esperado: lista com os 5 eventos
--   select count(*) from notification_preferences;   -- esperado: igual ao de antes
--
-- Reversão (só funciona se nenhuma linha usar 'platform_message'; apague essas linhas antes, se existirem):
--   ALTER TABLE notification_preferences DROP CONSTRAINT notification_preferences_event_check;
--   ALTER TABLE notification_preferences
--     ADD CONSTRAINT notification_preferences_event_check
--     CHECK (event IN ('match', 'qr_scan', 'chat_message', 'returned'));
