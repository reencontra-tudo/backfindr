-- Migration 019 -- revogar grants de anon/authenticated em 3 tabelas (31/10/2026)
--
-- FASE 2 de 2. SÓ RODAR DEPOIS de a 018 (RLS ligado) estar aplicada e validada.
--
-- Hoje anon e authenticated têm SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER nas 3 tabelas e USAGE na sequence municipality_events_id_seq, por
-- ALTER DEFAULT PRIVILEGES do schema public. Com RLS ligado e sem policies o
-- acesso já volta vazio; revogar os grants é a segunda camada: a API pública
-- passa a responder erro de permissão em vez de 0 linhas, e TRUNCATE/TRIGGER/
-- REFERENCES deixam de estar concedidos a essas roles.
--
-- A aplicação não é afetada: usa a conexão direta do servidor, não as roles
-- anon/authenticated. service_role e postgres mantêm os grants.
--
-- NÃO altera os ALTER DEFAULT PRIVILEGES do schema public (decisão separada):
-- tabelas novas continuam nascendo com grants para anon/authenticated e
-- precisam de ENABLE ROW LEVEL SECURITY na própria migration.
--
-- Idempotente: REVOKE repetido não faz nada.

REVOKE ALL ON public.state_emergency_contacts FROM anon, authenticated;
REVOKE ALL ON public.municipality_events FROM anon, authenticated;
REVOKE ALL ON public.signal_contact_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.municipality_events_id_seq FROM anon, authenticated;

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select c.relname,
--          has_table_privilege('anon', c.oid, 'SELECT')          as anon_sel,
--          has_table_privilege('authenticated', c.oid, 'SELECT') as auth_sel,
--          has_table_privilege('service_role', c.oid, 'SELECT')  as service_sel
--     from pg_class c
--    where c.oid in ('public.state_emergency_contacts'::regclass,
--                    'public.municipality_events'::regclass,
--                    'public.signal_contact_attempts'::regclass)
--    order by 1;                       -- esperado: anon_sel = false, auth_sel = false, service_sel = true
--   select has_sequence_privilege('anon', 'public.municipality_events_id_seq', 'USAGE');   -- esperado: false
--
-- COMO DESFAZER (reabre o acesso das roles; com RLS ligado e sem policies
-- continuam sem ver linhas):
--   GRANT ALL ON public.state_emergency_contacts TO anon, authenticated;
--   GRANT ALL ON public.municipality_events TO anon, authenticated;
--   GRANT ALL ON public.signal_contact_attempts TO anon, authenticated;
--   GRANT ALL ON SEQUENCE public.municipality_events_id_seq TO anon, authenticated;
-- ============================================================
