Ordem de aplicação no banco do «Resolve Tudo» (SQL Editor), como o papel do teste (assim ele é o dono de tudo e `DROP SCHEMA ... CASCADE` limpa tudo):

```sql
set role backfindr_teste_app;
set search_path = backfindr_teste, extensions;
-- 1) o esquema do Backfindr, gerado por gerar-esquema.sql (cole o conteúdo de esquema.sql aqui)
-- 2) a migration 026:  src/db/migrations/026_colaboradores.sql
-- 3) o seed do @backfindr:  docs/programa-colaboradores/seed-backfindr.sql
-- 4) dados mínimos do teste:
insert into payment_settings (key, value, description, is_secret) values ('payments_enabled', 'false', 'teste isolado: sem cobrança', false) on conflict do nothing;
reset role;
```
Depois: rodar `comparar-esquema.sql` na origem (`-v S=public`) e no destino (`-v S=backfindr_teste`) e conferir que as 5 linhas são iguais (o destino terá também a tabela `colaboradores` e as 2 colunas da 026: a origem, que ainda não tem a 026, mostra a diferença esperada só nessas linhas; para comparar sem ruído aplique a 026 também numa cópia da origem ou compare ANTES de aplicar a 026).
