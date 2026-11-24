-- SUPERADO em 24/11/2026: a verificação isolada no «Resolve Tudo» foi CANCELADA pelo fundador (nada foi executado lá; não há nada a limpar; decisão PC-10).
-- Mantido só como registro. Caminho atual: docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md
-- SOMENTE LEITURA. Assinatura do esquema de um schema (colunas, índices, restrições, gatilhos, funções), normalizada para comparar a ORIGEM com o DESTINO.
-- Uso: psql "<origem>"  -At -v S=public           -f comparar-esquema.sql      (no banco do Backfindr, em modo leitura)
--      psql "<destino>" -At -v S=backfindr_teste  -f comparar-esquema.sql      (no banco de teste)
-- Os dois resultados devem ser IGUAIS (mesmo md5 e mesma contagem em cada linha). O prefixo do schema é removido antes de calcular.
select 'colunas' t, md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||regexp_replace(coalesce(column_default,''), '(public|backfindr_teste)\.', '', 'g')||':'||is_nullable, '|' order by table_name, ordinal_position)), count(*) from information_schema.columns where table_schema = :'S'
union all select 'indices', md5(string_agg(replace(indexdef, ' '||:'S'||'.', ' public.'), '|' order by indexname)), count(*) from pg_indexes where schemaname = :'S'
union all select 'restricoes', md5(string_agg(regexp_replace(conrelid::regclass::text, '(public|backfindr_teste)\.', '', 'g')||':'||conname||':'||regexp_replace(pg_get_constraintdef(oid), '(public|backfindr_teste)\.', '', 'g'), '|' order by conrelid::regclass::text, conname)), count(*) from pg_constraint where connamespace = (select oid from pg_namespace where nspname = :'S')
union all select 'gatilhos', md5(string_agg(tgname, '|' order by tgname)), count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace=(select oid from pg_namespace where nspname=:'S') and not tgisinternal
union all select 'funcoes', md5(string_agg(proname, '|' order by proname)), count(*) from pg_proc where pronamespace=(select oid from pg_namespace where nspname=:'S')
