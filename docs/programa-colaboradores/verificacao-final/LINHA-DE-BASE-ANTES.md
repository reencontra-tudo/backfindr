> **SUPERADO em 24/11/2026.** A verificação isolada no projeto «Resolve Tudo» foi **CANCELADA pelo fundador**; **nada foi executado lá, não há nada a limpar** (decisão PC-10 em `DECISOES.md`). Este arquivo fica só como registro. Caminho atual: `../LANCAMENTO-CONTROLADO.md`.

# «Resolve Tudo» — linha de base do «antes» (23/11/2026)

Resultado do `catalogo-resolve-tudo.sql`, rodado pelo fundador no SQL Editor do painel (somente leitura: só catálogo, nada do Storage, nenhuma linha de tabela). **Esta é a referência para comparar depois da limpeza.** Nenhum segredo aqui.

| Consulta | Resultado |
|---|---|
| 1. Schemas e contagens | `auth`: 27 tabelas · `extensions`: 0 tabelas, 2 visões · `graphql`: 0 · `realtime`: 3 tabelas · `storage`: 10 tabelas · `vault`: 1 tabela, 1 visão. **Nenhum objeto em `public`.** |
| 2. Tabelas fora dos schemas internos | **Nenhuma** |
| 3. Funções, políticas e gatilhos em `public` e em schemas não internos | **Nenhum** |
| 4. Extensões | `pg_graphql` (graphql), `pg_stat_statements` (extensions), `pgcrypto` (extensions), `plpgsql` (pg_catalog), `supabase_vault` (vault), `uuid-ossp` (extensions). **`pg_trgm` NÃO existe: o teste a cria e a limpeza a remove.** |
| 5. Papéis e colisões | nenhum papel não padrão; o schema `backfindr_teste` **não existe**; o papel `backfindr_teste_app` **não existe** |

## Consulta 6 — assinatura do catálogo (o «antes»; depois da limpeza tudo deve voltar a ser IGUAL)
| Item | Schema | Total | Assinatura (md5) |
|---|---|---|---|
| extensões | — | 6 | `6b95d743a1654a902017d23e0692102d` |
| funções | auth | 4 | `919780c5cd99572ce829c34474532855` |
| funções | extensions | 55 | `5a5b71647ba3d4b708cb7fd85a5f9eb5` |
| funções | graphql | 6 | `83dcf12cf35ee18d1b46d1cbc7b13894` |
| funções | graphql_public | 1 | `572cda51902b5b517c0e1a2b2fd004b4` |
| funções | pgbouncer | 1 | `c575b1055631a95a5da497bf0d377092` |
| funções | realtime | 15 | `36849298b6c95ca0ef0d0757d748aecc` |
| funções | storage | 24 | `3202e72aff845eb146477d2c5aa5853b` |
| funções | vault | 5 | `0451ea9a6cd6954896f600ef7ab4da8c` |
| objetos | auth | 136 | `1e7a6c9e6a6621a50d77647730102c31` |
| objetos | extensions | 2 | `fe4cf27a2ef1b5680a043c774ae51318` |
| objetos | graphql | 1 | `09dd05c09c8b0943318eb984ea3fc383` |
| objetos | realtime | 13 | `4af44a18a4eafa654841547b3ba5c6fc` |
| objetos | storage | 36 | `b384591f6f7e0050b077829576c38deb` |
| objetos | vault | 4 | `6d9f41f0b2d8b4a14faf39ee44b466d7` |
| papéis | — | 29 | `af03ff21b287ff51b0fd97d52458835b` |

**O que muda durante o teste (esperado) e deve voltar ao valor acima depois da limpeza:** extensões 6 → 7 (`pg_trgm`); funções e objetos do schema `extensions` aumentam (a `pg_trgm` cria funções e operadores lá); papéis 29 → 30 (`backfindr_teste_app`); o schema `backfindr_teste` aparece (a consulta 6 o ignora). **O que NÃO pode mudar nunca:** `auth`, `storage`, `realtime`, `vault`, `graphql`, `graphql_public`, `pgbouncer` (nenhum desses é tocado pelo teste).

## Correção do SQL (feita em 23/11/2026)
A consulta 6 do `catalogo-resolve-tudo.sql` falhava com «operator is not unique: text || "char"» em `c.relname || ':' || c.relkind`. Corrigido para `c.relkind::text` (a linha de base acima já foi gerada com a correção). **Conferido o resto da pasta:** nenhum outro SQL concatena colunas do tipo «char» (`gerar-esquema.sql`, `comparar-esquema.sql`, `preparar-schema-teste.sql` e `limpar-schema-teste.sql` só comparam esses valores). O `catalogo-resolve-tudo.sql` corrigido rodou **inteiro, sem erro**, num banco local de ensaio.

## Ensaio local completo dos SQL da pasta (sem tocar em nenhum banco real)
Banco descartável imitando o «Resolve Tudo» (schema `extensions` com `pgcrypto` e `uuid-ossp`, sem `pg_trgm`): catálogo (baseline) → `preparar-schema-teste.sql` (schema, extensão, papel) → `set role` → aplicar o esquema gerado por `gerar-esquema.sql` como o papel → **assinatura do esquema idêntica à da origem** → 026 e seed → **conexão como o papel**: `search_path` certo, escrita funciona, tabela com RLS funciona para o dono, **não cria nada em `public`** (permissão negada) → `limpar-schema-teste.sql` → catálogo de novo: **assinatura IGUAL à de antes**, e schema, papel e extensão de teste inexistentes.
