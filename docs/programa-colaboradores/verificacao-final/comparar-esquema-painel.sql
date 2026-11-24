-- SUPERADO em 24/11/2026: a verificação isolada no «Resolve Tudo» foi CANCELADA pelo fundador (nada foi executado lá; não há nada a limpar; decisão PC-10).
-- Mantido só como registro. Caminho atual: docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md
-- SOMENTE LEITURA. Versão para colar no SQL Editor do painel (sem variáveis do psql).
-- Para a ORIGEM (projeto «backfindr»): rode como está (schema 'public').
-- Para o DESTINO (projeto «Resolve Tudo»): troque as 5 ocorrências de 'public' que são o nome do schema pela palavra 'backfindr_teste'
-- (use «localizar e substituir» de 'public' por 'backfindr_teste' no texto colado; as outras palavras do SQL não contêm a palavra public entre aspas).
-- As 5 linhas devem sair IGUAIS (mesmo md5 e mesma contagem) nos dois projetos, ANTES de aplicar a 026 no destino.
-- Os dois resultados devem ser IGUAIS
select 'colunas' t, md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||regexp_replace(coalesce(column_default,''), '(public|backfindr_teste)\.', '', 'g')||':'||is_nullable, '|' order by table_name, ordinal_position)), count(*) from information_schema.columns where table_schema = 'public'
union all select 'indices', md5(string_agg(replace(indexdef, ' '||'public'||'.', ' public.'), '|' order by indexname)), count(*) from pg_indexes where schemaname = 'public'
union all select 'restricoes', md5(string_agg(regexp_replace(conrelid::regclass::text, '(public|backfindr_teste)\.', '', 'g')||':'||conname||':'||regexp_replace(pg_get_constraintdef(oid), '(public|backfindr_teste)\.', '', 'g'), '|' order by conrelid::regclass::text, conname)), count(*) from pg_constraint where connamespace = (select oid from pg_namespace where nspname = 'public')
union all select 'gatilhos', md5(string_agg(tgname, '|' order by tgname)), count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace=(select oid from pg_namespace where nspname='public') and not tgisinternal
union all select 'funcoes', md5(string_agg(proname, '|' order by proname)), count(*) from pg_proc where pronamespace=(select oid from pg_namespace where nspname='public')
