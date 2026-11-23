-- NO BANCO DO «RESOLVE TUDO» (SQL Editor do painel; é o fundador quem roda, só DEPOIS de a conferência de leitura mostrar que não há colisão).
-- Cria um SCHEMA PRÓPRIO e um PAPEL PRÓPRIO para o teste. Nada é criado em `public`, em `storage` ou em `auth`, e o papel não recebe acesso a eles.
-- A SENHA do papel é escolhida pelo fundador NESTE editor e vai direto para a variável da Vercel; NUNCA cole a senha no chat.

create schema backfindr_teste;

-- pg_trgm: o Backfindr usa. Rode a linha abaixo SÓ se o catálogo (consulta 4) mostrou que a extensão NÃO existe; anote que foi o teste que a criou.
-- create extension if not exists pg_trgm with schema extensions;

create role backfindr_teste_app login password 'TROQUE-ESTE-TEXTO-POR-UMA-SENHA-FORTE-GERADA-POR-VOCE' nocreatedb nocreaterole nobypassrls;
alter role backfindr_teste_app set search_path = backfindr_teste, extensions;   -- o app, sem alteração de código, só enxerga o schema do teste
grant usage, create on schema backfindr_teste to backfindr_teste_app;
grant usage on schema extensions to backfindr_teste_app;                        -- para o operador gin_trgm_ops (só se o schema «extensions» existir)
grant backfindr_teste_app to postgres;                                          -- permite «set role» ao aplicar o esquema, para o papel ser o dono dos objetos
-- (nenhum GRANT em public, storage, auth ou realtime: o papel não tem acesso a eles)

-- Verificação (somente leitura): o papel só enxerga o schema do teste
--   select nspname, has_schema_privilege('backfindr_teste_app', nspname, 'USAGE') as usa from pg_namespace where nspname in ('backfindr_teste','public','storage','auth') order by 1;
--   esperado: backfindr_teste = true; storage = false; auth = false; (public pode ser true por padrão do Postgres, mas o papel não tem tabelas lá)
