-- SOMENTE LEITURA. Catálogo do banco do projeto «Resolve Tudo» (nomes e contagens). Rode no SQL Editor do próprio painel do Supabase.
-- NÃO lê nenhuma linha de nenhuma tabela e NÃO toca no Storage (os arquivos e os documentos ficam fora destas consultas).
-- Cole o resultado de cada consulta (são só nomes e números; nenhum segredo) para a conferência. Rode as mesmas consultas DEPOIS da limpeza e compare.

-- 1) Schemas e quantos objetos cada um tem
select n.nspname as schema,
       count(*) filter (where c.relkind in ('r','p')) as tabelas,
       count(*) filter (where c.relkind in ('v','m'))  as visoes,
       count(*) filter (where c.relkind = 'S')         as sequencias,
       count(*) filter (where c.relkind = 'i')         as indices
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
 group by 1 order by 1;

-- 2) Tabelas FORA dos schemas internos do Supabase. ESPERADO: nenhuma linha. Se aparecer qualquer tabela, PARE e avise (estimativa de linhas vem do catálogo, sem ler dados).
select n.nspname as schema, c.relname as tabela, greatest(c.reltuples, 0)::bigint as linhas_estimadas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r','p')
   and n.nspname not in ('auth','storage','realtime','vault','extensions','graphql','graphql_public','pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','net','cron','pgbouncer','_realtime','_analytics')
   and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
 order by 1, 2;

-- 3) Funções, tipos, gatilhos e políticas nos schemas que não são internos do Supabase (ESPERADO: nenhuma)
select 'funcao' as tipo, n.nspname as schema, p.proname as nome from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public') or (n.nspname not in ('auth','storage','realtime','vault','extensions','graphql','graphql_public','pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','net','cron','pgbouncer','_realtime','_analytics','pg_catalog','information_schema') and n.nspname !~ '^pg_')
union all select 'politica', schemaname, policyname from pg_policies where schemaname = 'public'
union all select 'gatilho', n.nspname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
order by 1, 2, 3;

-- 4) Extensões instaladas e o schema de cada uma (o teste precisa de pg_trgm; anote se ela já existe: só se NÃO existir é que o teste a cria e a limpeza a remove)
select e.extname as extensao, n.nspname as schema, e.extversion as versao from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1;

-- 5) Papéis não padrão e COLISÕES com os nomes que o teste vai usar (ESPERADO: nenhum papel «backfindr_teste_app» e nenhum schema «backfindr_teste»)
select rolname as papel from pg_roles where rolname !~ '^(pg_|supabase_|authenticator|anon$|authenticated$|service_role$|postgres$|dashboard_user|pgbouncer|cli_login_postgres|supautils_admin)' order by 1;
select 'schema backfindr_teste existe?' as pergunta, exists (select 1 from pg_namespace where nspname = 'backfindr_teste') as resposta
union all select 'papel backfindr_teste_app existe?', exists (select 1 from pg_roles where rolname = 'backfindr_teste_app');

-- 6) ASSINATURA DO CATÁLOGO (antes e depois): deve ser IGUAL antes de começar e depois da limpeza. Ignora o schema do teste.
select 'objetos por schema' as item, n.nspname as chave, count(*)::text as total, md5(string_agg(c.relname || ':' || c.relkind::text, ',' order by c.relname, c.relkind::text)) as assinatura
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname <> 'backfindr_teste' and n.nspname !~ '^pg_' and n.nspname <> 'information_schema' group by n.nspname
union all select 'funcoes por schema', n.nspname, count(*)::text, md5(string_agg(p.proname, ',' order by p.proname, p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname <> 'backfindr_teste' and n.nspname !~ '^pg_' and n.nspname <> 'information_schema' group by n.nspname
union all select 'extensoes', '-', count(*)::text, md5(string_agg(extname, ',' order by extname)) from pg_extension
union all select 'papeis', '-', count(*)::text, md5(string_agg(rolname, ',' order by rolname)) from pg_roles
order by 1, 2;
