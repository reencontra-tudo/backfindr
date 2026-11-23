-- LIMPEZA no banco do «Resolve Tudo» (SQL Editor; o fundador roda quando o teste terminar). Remove TUDO o que o teste criou e nada mais.
drop schema if exists backfindr_teste cascade;                 -- tabelas, índices, funções, gatilhos e dados do teste
reassign owned by backfindr_teste_app to postgres;
drop owned by backfindr_teste_app;                              -- remove também privilégios concedidos ao papel
drop role if exists backfindr_teste_app;
-- Só se o catálogo de ANTES NÃO listava a extensão e foi o teste que a criou:
-- drop extension if exists pg_trgm;
-- Depois: rode de novo catalogo-resolve-tudo.sql e confira que as linhas da consulta 6 (assinatura) são IGUAIS às de antes, e que as consultas 2 e 3 continuam vazias.
