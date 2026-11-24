-- SUPERADO em 24/11/2026: a verificação isolada no «Resolve Tudo» foi CANCELADA pelo fundador (nada foi executado lá; não há nada a limpar; decisão PC-10).
-- Mantido só como registro. Caminho atual: docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md
-- LIMPEZA no banco do «Resolve Tudo» (SQL Editor; o fundador roda quando o teste terminar). Remove TUDO o que o teste criou e nada mais.
drop schema if exists backfindr_teste cascade;                 -- tabelas, índices, funções, gatilhos e dados do teste
reassign owned by backfindr_teste_app to postgres;
drop owned by backfindr_teste_app;                              -- remove também privilégios concedidos ao papel
drop role if exists backfindr_teste_app;
-- O catálogo de ANTES (23/11/2026) NÃO tinha a pg_trgm: foi o teste que a criou, então a limpeza a remove.
drop extension if exists pg_trgm;
-- Depois: rode de novo catalogo-resolve-tudo.sql e confira que as linhas da consulta 6 (assinatura) são IGUAIS às de antes, e que as consultas 2 e 3 continuam vazias.
