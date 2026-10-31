-- Migration 018 -- habilitar RLS em 3 tabelas expostas (31/10/2026)
--
-- FASE 1 de 2. O advisor de segurança do Supabase sinalizou como
-- rls_disabled_in_public (nível ERROR) as tabelas abaixo, criadas pelas
-- migrations 011, 013 e 016 sem RLS. Sem RLS e com os grants padrão do schema
-- public, a chave anon da API REST consegue ler, inserir, alterar e apagar
-- linhas delas.
--
--   state_emergency_contacts  (011)  sem uso no código da aplicação
--   municipality_events       (013)  SELECT em achados-perdidos/[cidade]/[categoria]/page.tsx
--                                    e em api/v1/local-pages/generate/route.ts
--   signal_contact_attempts   (016)  SELECT/INSERT em
--                                    api/v1/admin/matches/[id]/contact-attempts/route.ts
--                                    e SELECT em api/v1/admin/matches/route.ts
--
-- RLS ligado e NENHUMA policy (deny-all), o mesmo padrão de send_throttle_events
-- (017) e de 39 outras tabelas do schema public: ninguém lê nem grava pela API
-- pública do banco; a aplicação usa a conexão direta do servidor (pool pg,
-- DATABASE_URL), que não depende de RLS.
--
-- Esta migration NÃO revoga grants (isso é a 019, só depois de validar esta).
-- Idempotente: ENABLE ROW LEVEL SECURITY repetido não faz nada.

ALTER TABLE public.state_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_contact_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMO VERIFICAR DEPOIS DE RODAR (somente SELECT):
--   select relname, relrowsecurity from pg_class
--     where oid in ('public.state_emergency_contacts'::regclass,
--                   'public.municipality_events'::regclass,
--                   'public.signal_contact_attempts'::regclass)
--     order by 1;                                  -- esperado: relrowsecurity = true nas 3
--   select count(*) from pg_policies
--     where schemaname = 'public'
--       and tablename in ('state_emergency_contacts','municipality_events','signal_contact_attempts');
--                                                  -- esperado: 0
--   Advisor de segurança: rls_disabled_in_public deixa de listar as 3 tabelas.
--   Páginas /achados-perdidos/<cidade>/<categoria> continuam mostrando o bloco de evento.
--   Tela de matches do admin e GET .../contact-attempts continuam respondendo sem erro.
--
-- COMO DESFAZER (volta ao estado anterior; reabre a exposição):
--   ALTER TABLE public.state_emergency_contacts DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.municipality_events DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.signal_contact_attempts DISABLE ROW LEVEL SECURITY;
-- ============================================================
