-- Migration 014 — coluna `url` em `notifications` (22/08/2026)
--
-- Achado durante a auditoria do ciclo "Encontrei" (ver BACKFINDR.md): o
-- frontend de notificações (`src/app/dashboard/notifications/page.tsx`) já
-- lê `notif.url` e navega pra lá no clique (`if (notif.url) router.push(...)`),
-- mas NENHUM dos 6 lugares do código que fazem INSERT INTO notifications
-- preenche essa coluna — todo clique em notificação, em todo o produto, não
-- leva a lugar nenhum. Este item resolve especificamente o fluxo de
-- "Encontrei" (src/app/api/v1/objects/scan/[code]/notify/route.ts); os
-- outros 5 locais ficam registrados como backlog separado (ver seção 17 do
-- BACKFINDR.md), fora de escopo desta rodada.
--
-- IF NOT EXISTS: idempotente, seguro rodar mesmo se a coluna já existir.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS url TEXT;

COMMENT ON COLUMN notifications.url IS
  'Rota interna (ex: /dashboard/objects/{id}) para onde o clique na notificação deve navegar. NULL = notificação não-clicável (comportamento anterior a esta migration).';
