# Lançamento controlado do piloto (E0 a E3) na produção — plano (24/11/2026)

**Substitui a verificação isolada no «Resolve Tudo»** (cancelada pelo fundador em 24/11/2026; nada foi executado lá; ver `verificacao-final/LEIA-ME.md` e `DECISOES.md`, PC-10).

## Regras
1. **Regra número 1: NENHUMA REGRESSÃO.** Qualquer divergência em qualquer passo = **PARAR e reportar, sem tentar consertar por conta própria.**
2. **Autorização do fundador (24/11/2026):** os passos **0, 1, 2 e 3**, em sequência, um de cada vez; ao fim do passo 3, **parar e reportar**. O **passo 4 NÃO está autorizado** (só com nova ordem escrita).
3. Nenhum segredo no chat, em commit ou em arquivo do repositório. Nenhuma ocorrência real criada nos passos 0 a 3. Sem push direto na `main`; sem apagar branches.
4. Ao final de cada passo: atualizar `STATUS.md`, `DESENHO.md` e `BACKFINDR.md` e mostrar o resultado da comparação «antes × depois».

## Estado em 24/11/2026
| Passo | Estado |
|---|---|
| 0 — Preparação | **FEITO** (este plano; script `tools/comparar-producao.mjs`; dois retratos «antes» da produção) |
| 1 — Cópia de segurança | **CONFIRMADO (24/11/2026)** pelo backup próprio diário (repositório `m2r-backup-supabase`, run #36): ver «Passo 1». Não é preciso dump manual. |
| 2 — Migration 026 | **APLICADA e VERIFICADA (24/11/2026, 03:23 UTC)**, na segunda tentativa (a primeira ficou esperando a confirmação do conector e não aplicou nada). Ver «Passo 2 — resultado». |
| 3 — Mescla com interruptores desligados | **CONCLUÍDO e VERIFICADO (24/11/2026)**: #162 a #166 mesclados na ordem; ver «Passo 3 — resultado». |
| 4 — Ligar o piloto | **Roteiro final PRONTO (24/11/2026); NÃO executado; aguarda a ordem escrita do fundador** |

---

## PASSO 0 — Preparação (sem tocar em produção)
### 0.1 Pilha de PRs e ordem de mescla
A pilha é linear: `main (5e0749c, #158)` ← #162 ← #163 ← #164 ← #165 ← #166. **A `main` ainda está em `5e0749c`**, ancestral do topo da pilha: as mesclas entram sem conflito (se a `main` avançar antes de começar, **parar** e reavaliar).
| Ordem | PR | Conteúdo | Branch | Cabeça (SHA) |
|---|---|---|---|---|
| 1 | #162 | Diagnóstico e desenho (só documentação) | `claude/backfindr-colaboradores-desenho` | `0f84fb9291` |
| 2 | #163 | E0: rota `/@nome` pelo middleware (atrás de interruptor) | `claude/backfindr-colaboradores-e0` | `be6b5e5f1a` |
| 3 | #164 | E1: atribuição do código na ocorrência, validador e campo (migration 026) | `claude/backfindr-colaboradores-e1` | `6829fa41d3` |
| 4 | #165 | E2: página `/@nome`, feed da página, SEO, sitemap, aviso no admin | `claude/backfindr-colaboradores-e2` | `c6a94c670e` |
| 5 | #166 | E3: marca do colaborador no cartaz + documentação | `claude/backfindr-colaboradores-e3` | **o SHA que tiver na hora (inclui os commits de documentação deste plano)** |
(O SHA do #166 muda com os commits de documentação deste lançamento; usar `expectedHeadSha` com o valor lido na hora.)

**Comandos de mescla (para cada PR, na ordem, só no passo 3):**
1. `update_pull_request` com `base: "main"` (necessário para #163 a #166, empilhados; o #162 já aponta para `main`).
2. `update_pull_request` com `draft: false` (um PR em rascunho não pode ser mesclado).
3. `merge_pull_request` com `merge_method: "merge"` (commit de mescla, como nas mesclas anteriores) e `expectedHeadSha` = a cabeça do PR lida na hora.
4. Esperar a implantação de produção do commit de mescla ficar no ar (modo `impressao` do script muda; ver 0.2) e rodar a **comparação rápida** (`/`, `/feed`, `/@backfindr`).
Não apagar branches. Cada mescla gera uma implantação de produção; **todas são seguras com os interruptores desligados** (o código novo está atrás deles).

### 0.2 Script de comparação «antes × depois» da produção (somente leitura)
`tools/comparar-producao.mjs` faz **só pedidos GET públicos** (iguais aos de um visitante): sem login, sem formulário, sem criar nada.
- `capturar <arquivo.json>`: guarda um retrato de 13 rotas: `/`, `/feed`, `/achei`, `/perdi`, `/map`, `/pricing`, `/auth/login`, `/flow/found`, `/@backfindr`, `/colaborador/backfindr`, `/robots.txt`, `/sitemap.xml` e `/api/v1/colaboradores/validar?codigo=HX7R`. Para cada uma: código de resposta, endereço final, `<title>`, `meta robots`, `canonical`, `h1`, `X-Robots-Tag` e o texto visível (hash).
- `comparar <antes> <depois> [<antes2>]`: uma linha por rota (`OK`, `VARIAÇÃO NATURAL` ou `DIFERENTE`; saída 1 se houver qualquer `DIFERENTE`). Rotas com dados vivos (`/`, `/feed`, `/map`, `/achei`, `/sitemap.xml`) comparam o texto por similaridade (limiar 0,90, ajustado pela variação medida entre os dois «antes»); as demais, por igualdade.
- `impressao`: qual implantação está no ar (hash dos arquivos que a home carrega; **muda a cada deploy**).
- `cartazes <arquivo.json>`: baixa de novo os cartazes públicos guardados e compara o hash (**idêntico byte a byte** com o programa desligado).
- `bundle`: procura, no código que o navegador baixa na página de cadastro, os trechos do programa («Código do colaborador», `bf_colab`, `/api/v1/colaboradores`, `colaborador_codigo`). **Com o programa desligado, todos devem estar ausentes.**
- No ambiente com proxy: `NODE_USE_ENV_PROXY=1`.
**Retratos «antes» já capturados** (24/11/2026, 02:20 UTC, dois, 28 s de intervalo, para medir a variação natural): `docs/programa-colaboradores/lancamento/antes-1.json` e `antes-2.json`. Entre os dois: **tudo igual**; só o texto do `/feed` mudou sozinho (tempos relativos; similaridade 1,000).

### 0.3 O «antes» da produção (resumo)
| Rota | Resposta |
|---|---|
| `/`, `/feed`, `/achei`, `/map`, `/pricing`, `/auth/login`, `/flow/found`, `/robots.txt`, `/sitemap.xml` | 200 |
| `/perdi` | 307 (já é assim hoje: a página faz `redirect('/flow/lost')`) |
| `/@backfindr`, `/colaborador/backfindr`, `/api/v1/colaboradores/validar` | **404** |
| `POST /api/v1/objects` sem login | 401 `{"detail":"Unauthorized"}` |
| `GET /api/v1/objects/public?limit=1` | 200 |
| Implantação no ar (`impressao`) | `ce5fc691abb0904d` |
| `bundle` (página de cadastro) | **nenhum** trecho do programa nos 19 arquivos `.js` lidos |

---

## PASSO 1 — Cópia de segurança do banco de produção (somente leitura do banco)
### 1.1 O que foi feito (leitura, 24/11/2026)
**Assinatura do esquema de `public`** (consulta de catálogo; antes da 026):
| Item | Total | Assinatura (md5) |
|---|---|---|
| colunas | 667 | `0b1db7bd3741ddf96231d6e55e4ab828` |
| índices | 200 | `aa1d16c1461641f1c239534f1f250975` |
| restrições | 191 | `19d7e101c0495197af6343c0f74240fe` |
| gatilhos | 4 | `8406f67f218262c5b84a8a66c639ca37` |
| funções | 34 | `53b9a1ece49cf9343a0d60aeccdcc0b5` |
| tabelas | 56 | `6854d4f367a380747f322c73af5ecd9e` |
Também: PostgreSQL 17.6; banco com 50 MB; **`objects` sem nenhuma coluna `colaborador_*`**; **tabela `colaboradores` inexistente**.

**Linhas por tabela** (contagem exata, 24/11/2026): `users` 4.367 · `objects` 2.227 · `matches` 1.350 · `object_events` 49.537 · `user_lifecycle_events` 6.128 · `marketing_leads` 972 · `public_signal_evidence` 902 · `local_pages` 441 · `marketing_lead_acoes` 328 · `notifications` 134 · `municipality_events` 107 · `municipalities` 63 · `seo_content_seeds` 46 · `community_posts` 44 · `magic_link_tokens` 32 · `email_events` 15 · `email_messages` 15 · `payment_settings` 13 · `state_emergency_contacts` 11 · `analytics_snapshots` 9 · `marketing_apify_configs` 8 · `mensagens_conversa` 8 · `subscriptions_p1` 7 · `email_campaigns` 6 · `push_subscriptions` 6 · `community_comments` 5 · `send_throttle_events` 5 · `subscriptions` 4 · `plan_configs` 3 · `boosts` 2 · `conversas` 2 · `password_reset_tokens` 2 · `unidades` 2 · `analytics_tokens` 1 · `chat_messages` 1 · `condominios` 1 · `marketing_config` 1 · as demais (27 tabelas) com 0 linhas. Total: 56 tabelas.
**Regra para comparar contagens depois (os dados são vivos):** tabelas de eventos e cadastros crescem sozinhas (`object_events`, `user_lifecycle_events`, `users`, `objects`, `notifications`, `email_*`). A regra é: **nenhuma contagem pode DIMINUIR**; para `users`, `objects` e `matches`, o número a mais tem de ser explicado por linhas com `created_at` posterior ao retrato; tabelas estáticas (as de configuração, de municípios, `local_pages`, `seo_content_seeds` etc.) devem ficar **iguais**.

### 1.2 Cópia de segurança: o backup próprio diário (corrige o registro anterior)
**Correção de registro (informação do fundador, 24/11/2026):** o Supabase do Backfindr **não tem backup nativo** (plano Free), **mas existe um backup próprio diário e ele funciona**: repositório `reencontra-tudo/m2r-backup-supabase`, fluxo `backup-supabase.yml` (GitHub Actions, `pg_dump` 17 em formato custom, com um papel **somente leitura** `backup_ro`, enviado ao bucket R2 `m2r-bancos-backup`, caminho `backfindr-supabase/postgres/diario/AAAA/MM/`), mais um **teste de restauração** (`teste-restore.yml`). Qualquer frase anterior (neste plano, em `STATUS.md`, `DESENHO.md` ou `BACKFINDR.md`) que dissesse que não há backup foi **corrigida** nesta data.

### 1.3 Confirmação da integridade da cópia (por SOMENTE LEITURA, 24/11/2026)
**Como foi confirmado:** pelos metadados e pelo registro (log) da execução, lidos pelo GitHub (sem baixar nenhum dado e sem acesso ao R2: as credenciais do R2 estão no cofre local do fundador e **não foram usadas nem vistas por esta sessão**). O próprio `backup.sh` faz as verificações e imprime só contagens e tamanhos (nunca URL, senha ou chave).
| Item | Resultado |
|---|---|
| Execução | **run #36** (id 45317836084), `workflow_dispatch`, disparada em **24/11/2026 03:12:13 UTC (00:12 em Brasília)**, **concluída com sucesso** em ~71 s; 36 execuções no total, as anteriores (agendadas, diárias) também com sucesso (#31 a #35 conferidas) |
| Origem | papel somente leitura `backup_ro` (não é superusuário), servidor 17.6, **56 tabelas em `public`**, banco de **50 MB** (igual ao que esta sessão mediu) |
| Arquivo gerado | **5.890.594 bytes** (`pg_dump --format=custom --compress=9`), cliente `pg_dump` 17.12 |
| Conteúdo (`pg_restore --list`) | **1.245 objetos; 56 tabelas em `public`; 56 tabelas COM DADOS (`TABLE DATA`)** |
| Envio ao R2 | tamanho no R2 = **5.890.594 bytes** (igual ao local) e **SHA-256 conferido**; o arquivo foi **baixado de volta** do R2 e listado: **1.245 objetos** (igual) |
| Destino | bucket `m2r-bancos-backup`, caminho `backfindr-supabase/postgres/diario/2026/11/` (nome `backfindr-supabase_<data UTC>.dump`; o nome exato não é impresso no log) |
| Momento do dump | 03:12:43 a 03:13:12 UTC, **antes de qualquer alteração da 026**: é o estado «antes» |
| Teste de restauração | último com sucesso: **run #8, em 16/11/2026** (restaura num PostgreSQL 17 descartável e compara). O agendado de 05/11 (#7) falhou antes de um conserto (PR #5 do repositório do backup), e o de 16/11, depois do conserto, passou. As mensagens de erro do `vault.*` no log são esperadas (esquema interno do Supabase que não existe num PostgreSQL comum), não afetam `public` |
**Limites desta confirmação (honestos):** (a) **não listei o objeto no R2 com as credenciais** (não as tenho): confio nas verificações que o próprio fluxo fez e registrou (tamanho, SHA-256 e leitura de volta). (b) O log **não traz as contagens de linhas** de `users`, `objects` e `matches` dentro do dump; elas estão em 1.1 (medidas ao vivo nesta data) e o teste de restauração do fluxo compara contagens. (c) O teste mensal de restauração mais recente com sucesso é de 16/11, não de hoje. **Nada disso impede o passo 2:** a 026 é aditiva e reversível, e o dump de 00:12 é íntegro pelas verificações do próprio fluxo.

### 1.4 Como restaurar, se for preciso
- **Só a migration 026 (o caso mais provável):** não precisa do backup; basta a **reversão** do passo 2.5 (colunas e tabela novas, vazias).
- **Uma tabela ou o banco:** baixar o `.dump` do R2 (credenciais do cofre do fundador), `pg_restore --no-owner --no-privileges` para um banco descartável, conferir contagens e, se for o caso, restaurar a tabela (`-t <tabela> --data-only`) ou criar um projeto novo e apontar a `DATABASE_URL` (decisão do fundador). O `teste-restore.yml` do repositório do backup mostra o procedimento automatizado.

### 1.5 Estado do passo 1
**COMPLETO (24/11/2026).** Cópia íntegra, de 00:12 BRT, com as 56 tabelas com dados. Os passos 2 e 3 seguem autorizados, um de cada vez, parando em qualquer divergência.

---

## PASSO 2 — Migration 026 na produção (só depois do passo 1 completo)
### 2.1 O que será aplicado
**Somente** `src/db/migrations/026_colaboradores.sql` (98 linhas; SHA-256 `b73da9d3e9577554689133e19753acc385c74bcc578eb9195dfe994931e9d99b`), **exatamente como testada** (testes de integração, reversão, ensaio local). Confirmar o hash do arquivo antes de aplicar (`sha256sum`). Não aplicar o seed neste passo (a página `@backfindr` só existe no passo 4).
### 2.2 Como aplicar
Pelo conector (`execute_sql`, **não** `apply_migration`: este grava um registro em `supabase_migrations`, objeto extra que a 026 não prevê). O texto enviado = 3 linhas de proteção de sessão + o arquivo, sem mais nada:
```sql
set local lock_timeout = '5s';        -- se o objects estiver travado por outra sessão, desiste em vez de esperar
set local statement_timeout = '60s';
-- (conteúdo integral de 026_colaboradores.sql)
```
O envio é **uma única consulta**: o Postgres a executa numa **transação implícita única** (tudo ou nada: qualquer erro desfaz tudo). O `ALTER TABLE objects ADD COLUMN` (colunas nulas, sem valor padrão) é instantâneo; segura um travamento exclusivo de milissegundos. **Escolher um horário de pouco movimento** e avisar o fundador antes de aplicar.
### 2.3 Verificações logo depois (só leitura)
| Verificação | Esperado |
|---|---|
| `objects` tem `colaborador_id` (uuid, nulo) e `colaborador_codigo` (text, nulo) | 2 colunas, ambas `YES` para nulo |
| `select count(*) from objects where colaborador_id is not null or colaborador_codigo is not null` | **0** |
| tabela `colaboradores` existe, com RLS ligado e **0 linhas** | `relrowsecurity = true`; `count = 0` |
| gatilhos `trg_objects_colaborador_imutavel` (em `objects`, `BEFORE UPDATE OF colaborador_id, colaborador_codigo ... WHEN`) e `trg_colaboradores_sem_delete` | presentes |
| contagens de esquema, **depois**: tabelas 57 (+1), colunas 689 (+22), índices 205 (+5), restrições 203 (+12), gatilhos 6 (+2), funções 36 (+2) | exatamente esses (deltas medidos num ensaio local da mesma migration) |
| nenhum dado existente alterado: contagens de todas as tabelas conforme a regra do passo 1.1; `objects` com `created_at <= retrato` **igual** a 2.227 (ou o número explicável) | sem diminuição; mesmas linhas |
| `payment_settings`, `plan_configs`, `boosts`: iguais (13, 3, 2) | iguais |
### 2.4 Comparação da produção (código ainda é o de antes)
`node tools/comparar-producao.mjs capturar lancamento/depois-passo2.json` e `comparar antes-1.json depois-passo2.json antes-2.json` → **tudo OK** (o código no ar não mudou; a 026 não deve alterar nenhuma página nem API). Também `impressao` = `ce5fc691abb0904d` (nenhum deploy) e `bundle` = ausente.
### 2.5 Reversão (enquanto nada usar as estruturas novas: o caso, com o programa desligado)
```sql
drop trigger if exists trg_objects_colaborador_imutavel on objects;
drop function if exists objects_colaborador_imutavel();
drop index if exists idx_objects_colaborador;
alter table objects drop column if exists colaborador_codigo;
alter table objects drop column if exists colaborador_id;
drop trigger if exists trg_colaboradores_sem_delete on colaboradores;
drop table if exists colaboradores;
drop function if exists colaboradores_sem_delete();
```
(a reversão está no fim do próprio arquivo e foi testada.) Depois, repetir a assinatura do passo 1.1: **tem de voltar à de antes**. Se o código do passo 3 já estiver no ar, a reversão também é segura (o código novo só toca nessas colunas com o interruptor ligado), mas não deve ser necessária.
O **código antigo continua funcionando com a 026 aplicada** (a 026 só acrescenta).

### Passo 2 — resultado (24/11/2026)
**Aplicação:** `execute_sql` (não `apply_migration`), texto = `set local lock_timeout = '5s'; set local statement_timeout = '60s';` + o arquivo `026_colaboradores.sql` **sem nenhuma alteração** (SHA-256 `b73da9d3…`), numa única transação implícita. **Sem erro.** Antes: tabela e colunas inexistentes, **0 travas fortes em `objects`, 0 sessões ativas** (retrato T0 = 03:22:27 UTC). Depois: 03:23:39 UTC. (Primeira tentativa, 03:2x UTC: o conector esperou uma confirmação do usuário e esgotou o tempo; nada foi aplicado; conferido por leitura.)
| Verificação | Esperado | Resultado |
|---|---|---|
| `objects.colaborador_id` e `objects.colaborador_codigo` | 2 colunas, nulas | `uuid`/`text`, ambas **nulo = YES** |
| `objects` com atribuição preenchida | 0 | **0** |
| tabela `colaboradores`: existe / RLS / linhas | sim / ligado / 0 | **true / true / 0** |
| gatilho `trg_objects_colaborador_imutavel` | `BEFORE UPDATE OF colaborador_id, colaborador_codigo ... WHEN (...)` | **presente, definição igual à da 026** |
| gatilho `trg_colaboradores_sem_delete` | `BEFORE DELETE` | **presente** |
| privilégios de `anon`/`authenticated` em `colaboradores` | 0 | **0** |
| contagens do esquema | tabelas 57, colunas 689, índices 205, restrições 203, gatilhos 6, funções 36 | **57, 689, 205, 203, 6, 36 (exatamente)** |
| **Nada além dos objetos novos mudou:** as 6 assinaturas do passo 1, recalculadas **sem** os objetos novos | iguais às de antes | **IGUAIS** (colunas `0b1db7bd…`, índices `aa1d16c1…`, restrições `19d7e101…`, gatilhos `8406f67f…`, funções `53b9a1ec…`, tabelas `6854d4f3…`) |
| **Aplicada exatamente como testada:** 7 assinaturas das definições novas (colunas, restrições, índices, corpo das funções, gatilhos, colunas e FK em `objects`) comparadas com um banco local onde apliquei o mesmo arquivo | iguais | **IGUAIS nas 7** |
| dados existentes | iguais ao retrato T0 | `users` 4.367, `objects` 2.227, `matches` 1.350, `boosts` 2, `payment_settings` 13, `plan_configs` 3: **iguais**; **md5 dos ids** de `users`, `objects` e `matches` e **md5 do conteúdo (id, status, título)** de `objects`: **iguais**; nenhuma ocorrência nem usuário novo entre T0 e T1 |
**Comparação da produção «antes × depois do passo 2»** (`tools/comparar-producao.mjs`, 13 rotas): **tudo igual** (só o texto do `/feed` mudou sozinho, similaridade 1,000; `/@backfindr`, `/colaborador/backfindr` e `/api/v1/colaboradores/validar` continuam **404**); `impressao` = `ce5fc691abb0904d` (**nenhum deploy novo**); `bundle`: nenhum trecho do programa no navegador; **4 cartazes públicos reais idênticos byte a byte**; `POST /api/v1/objects` sem login = 401 como antes. Retrato guardado em `lancamento/depois-passo2.json`.
**Reversão (se necessária; nada usa as estruturas novas):** bloco de 2.5.

---

## PASSO 3 — Mescla com os interruptores DESLIGADOS (só depois do passo 2 verificado)
### 3.1 Pré-condições (todas)
1. **`COLABORADORES_ATIVO` e `NEXT_PUBLIC_COLABORADORES_ATIVO` NÃO existem em NENHUM ambiente da Vercel: CONFIRMADO em 24/11/2026** (verificado pelo Claude do navegador no painel e informado pelo fundador). (Esta sessão não lê as variáveis da Vercel; a confirmação é a deles.) Texto original da pré-condição: a confirmação é do **fundador ou do Claude do navegador** (Vercel → Settings → Environment Variables; procurar as duas; **nenhuma** das duas pode aparecer em Production nem em «All Environments»). Além disso, a verificação indireta pós-deploy (3.3) **pega** o erro: se alguma existisse, `/@backfindr` abriria e o `bundle` mostraria trechos.
2. **Implantação de produção atual (destino do Instant Rollback): `backfindr-3dtxeok5q`, commit `5e0749c`, de 19/11/2026** (informado pelo fundador; impressão `ce5fc691abb0904d`).
3. Passos 1 e 2 completos e verificados. A `main` ainda em `5e0749c`. Nenhum PR da pilha com alteração nova não revisada.
### 3.2 Mescla (na ordem do 0.1, um PR de cada vez, com os comandos do 0.1)
Depois de **cada** mescla: esperar a implantação (a `impressao` muda), rodar a comparação rápida (`/`, `/feed`, `/@backfindr` = 404, `/robots.txt`). **Qualquer divergência = parar.**
### 3.3 Verificação depois do último deploy
- `capturar lancamento/depois-passo3.json` e `comparar antes-1.json depois-passo3.json antes-2.json`: **tudo OK**. Em especial **`/@backfindr` = 404**, `/colaborador/backfindr` = 404 e `/api/v1/colaboradores/validar` = **404** (iguais ao «antes»: com o interruptor desligado o programa não existe), `sitemap.xml` e `robots.txt` iguais.
- **CRITÉRIO SUBSTITUÍDO por decisão do fundador (24/11/2026, durante o Passo 3):** o critério «nenhum trecho do programa no código do navegador» (comando `bundle`) **deixa de ser parada**. Em vez dele vale: **nenhum COMPORTAMENTO do programa com os interruptores desligados.** Motivo (achado ao mesclar o #164): o interruptor do navegador desliga o comportamento, mas os textos (`bf_colab`, `/api/v1/colaboradores`, `colaborador_codigo`) ficam como código inativo dentro dos arquivos da página de cadastro e do layout. O `bundle` continua sendo rodado e **anotado**, mas trechos inativos não param o Passo 3. Também podem ser só anotadas diferenças no **corpo da 404 de rotas internas novas do programa** (`/colaborador/<nome>`, `/api/v1/colaboradores/validar`; não públicas, não linkadas). **Qualquer outra diferença: parar.**
- **Verificação de comportamento (substitui o `bundle` como critério):** (i) `/@backfindr` e `/@BackFindr` = 404; (ii) `/api/v1/colaboradores/validar` = 404; (iii) `/flow/lost?colab=teste123` e `/flow/found?colab=teste123`: nada com «colab» em `sessionStorage`, `localStorage` ou cookie, campo «Código do colaborador» ausente, console sem erros (feito pelo Claude do navegador na produção em 24/11/2026); (iv) navegador automatizado (`lancamento/ultimo-passo/fluxo.js`): perdido, achado e roubado, com `?colab=teste123`, até o ÚLTIMO passo **sem enviar** (todas as chamadas `/api/v1/**` respondidas localmente pelo navegador de teste, nenhuma sai para a produção; nenhuma ocorrência criada), em 375 px e 1280 px: campo ausente, nenhuma chave «colab» guardada, **nenhuma requisição a `/api/v1/colaboradores`**; (v) cartaz de ocorrência sem código idêntico byte a byte (`cartazes`); (vi) `POST /api/v1/objects` sem login = 401.
- **Cadastro de ocorrência SEM código, por leitura de comportamento (nada é criado):** (a) `POST /api/v1/objects` sem login = **401 `{"detail":"Unauthorized"}`**, igual ao «antes»; (b) o HTML de `/flow/found` e o `bundle` iguais; (c) `GET /api/v1/objects/public` e o Feed iguais; (d) o cartaz de uma ocorrência **existente e pública** (`/api/v1/objects/<código>/poster?format=square`) devolve **200 PNG**, e **o mesmo arquivo que antes** (**já guardados** em `lancamento/antes-cartazes.json`: 4 imagens de 2 ocorrências públicas reais, estáveis em dois pedidos; conferir com `node tools/comparar-producao.mjs cartazes docs/programa-colaboradores/lancamento/antes-cartazes.json`: com o programa desligado o cartaz é idêntico byte a byte). **Não** criar ocorrência, conta, boost nem pagamento.
- Admin e painel: não alterados com o programa desligado (o aviso de interruptores não aparece); só se o fundador quiser, conferir logado.
- O banco: as contagens do passo 1.1 pela regra de não diminuir.
### 3.4 Reversão do passo 3
1. **Vercel → Deployments → Instant Rollback** para a implantação anotada em 3.1 (imediato, sem git). A `main` continua com as mesclas, mas a produção volta ao código de antes.
2. Para desfazer na `main`: abrir **PRs de reversão** (`git revert -m 1 <commit de mescla>`, do último para o primeiro) e mesclá-los sob ordem do fundador. **Não** fazer push direto na `main`.
3. A 026 **não** precisa ser revertida (aditiva).
### 3.5 Passo 3 — resultado (24/11/2026)
**Passo 3 CONCLUÍDO (24/11/2026): #162 a #166 mesclados na `main` em ordem, um de cada vez, com interruptores DESLIGADOS (não existem na Vercel); produção sem mudança de comportamento; PARADO aqui, Passo 4 NÃO iniciado.** Commits de mescla: #162 `9c7928ac`, #163 `10ca3b2e`, #164 `40d309de`, #165 `936850c8`, #166 `a2a4ca4f` (`main` em `a2a4ca4`). Impressão de produção: `ce5fc691abb0904d` → `004efedc3c60b3b2` → `6fc480ae26040ada` → `5836d4974d10097c` → `cadd3a3456f870ae` → `ae027c42f88d3438`. Comparação final «antes × depois» (`lancamento/depois-passo3.json`): 13 rotas iguais, exceto (a) `/feed` (variação natural, similaridade 1,000) e (b) o CORPO da 404 de duas rotas internas novas e não linkadas, aceitas por ordem do fundador (`/colaborador/backfindr`: 404 com corpo quase vazio em vez da tela padrão; `/api/v1/colaboradores/validar`: 404 com corpo vazio; status continua 404); `/@backfindr` e `/@BackFindr` = 404 iguais ao «antes»; `sitemap.xml` e `robots.txt` iguais (nenhuma menção a colaborador); 4 cartazes públicos reais **idênticos byte a byte**; `POST /api/v1/objects` sem login = 401. Trechos inativos do programa aparecem no código do navegador (`bf_colab`, `/api/v1/colaboradores`, `colaborador_codigo`): anotados, não são comportamento (critério substituído, PC-12). Verificação de comportamento em navegador automatizado (perdido, achado e roubado com `?colab=teste123`, até o último passo, SEM enviar, 375 px e 1280 px): campo «Código do colaborador» ausente, nenhuma chave «colab» guardada, nenhuma requisição a `/api/v1/colaboradores`, nenhuma ocorrência criada; e, pelo Claude do navegador na produção, `/flow/lost` e `/flow/found` com `?colab=` sem nada guardado. Reversão disponível: Instant Rollback para `backfindr-3dtxeok5q` (não usado). **Aguarda a ordem escrita do fundador para o Passo 4.**

**AO FIM DO PASSO 3: PARAR e reportar.**

---

## PASSO 4 — Ligar o piloto (**NÃO EXECUTAR; só com nova ordem escrita e com o fundador presente**)
**Versão final do roteiro, de 24/11/2026** (substitui a versão anterior; decisões do fundador: PC-13). Teste com a própria `/@backfindr`, **mantida SEM verificação** durante o teste (fica `noindex` e fora do sitemap); a marcação como verificada será decidida depois pelo fundador. Quem faz cada passo: **CODE** = esta sessão (banco, pelo conector, e GitHub); **NAV** = Claude do navegador (Vercel); **FUN** = fundador (passkey, login e decisões).

### 4.0 Antes de começar (todos os itens precisam estar prontos)
1. FUN: dá a ordem escrita para o Passo 4 e fica presente até o fim.
2. **Link de volta: `https://www.facebook.com/backfindr` — VERIFICADO em 24/11/2026 (~01:25) pelo Claude do navegador, informado pelo fundador:** o endereço responde e é a página oficial do Backfindr (nome «Backfindr», cerca de 46 mil seguidores, administrada pelo fundador; ex-Webjetos, renomeada). A foto de perfil da página é o mesmo símbolo do Backfindr, coerente com a imagem provisória. (Esta sessão não alcança o Facebook; a verificação é do Claude do navegador.) Nada a conferir antes do 4.1.
3. **Imagem: `https://backfindr.com/brand/app-icon.png`, escolha PROVISÓRIA do fundador** (responde 200 `image/png`); ele pode trocá-la depois de ver a página real, **sem deploy**: ver «Trocar a imagem» no 4.1.
4. CODE: confirma que a `main` e a produção estão como no fim do Passo 3 (`impressao` `ae027c42f88d3438`) e que os dois interruptores continuam ausentes.
5. NAV: abre Vercel → Settings → Environment Variables e anota o valor **atual** de `MATCHING_ATIVO` em Production (não presumir: o plano dizia «1», mas só o painel diz). Passa o valor para o CODE registrar em 4.6.

### 4.1 Criar o colaborador `@backfindr` (produção, NÃO verificado) — CODE
1. CODE: antes de escrever, confere que a tabela está vazia: `select count(*) from colaboradores;` → 0.
2. CODE: roda o SQL abaixo (uma instrução; o link de volta é o do item 4.0.2, já conferido pelo NAV). O código curto é **sorteado pelo banco** (4 caracteres do alfabeto sem 0, O, 1, I; não repete código nem @nome existente). **`verificado_em` fica vazio de propósito.** Testado em banco local descartável em 24/11/2026: cria 1 linha, uma segunda execução não cria nada, o `DELETE` é recusado pelo gatilho.
```sql
INSERT INTO colaboradores (slug, codigo_curto, nome, descricao, imagem_url, canal_url, modalidade, estado, interno)
SELECT 'backfindr', g.codigo, 'Backfindr',
       'Ocorrências de objetos, documentos e pets perdidos, achados ou roubados registradas no Backfindr.',
       'https://backfindr.com/brand/app-icon.png', 'https://www.facebook.com/backfindr', -- endereço VERIFICADO em 24/11/2026
       'comunidade_criador', 'ativo', TRUE
  FROM (SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '') AS codigo
          FROM generate_series(1, 4)) g
 WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE lower(slug) = 'backfindr')
   AND NOT EXISTS (SELECT 1 FROM colaboradores WHERE upper(codigo_curto) = upper(g.codigo))
RETURNING slug, codigo_curto, estado, interno, verificado_em IS NOT NULL AS verificado;
```
3. CODE: confere o resultado: 1 linha, `backfindr | <código> | ativo | true | false`. Se vier 0 linhas (código sorteado já existia), roda de novo.
4. CODE: anota o **código curto** gerado (não é segredo; vai para o roteiro de teste).
5. **Reversão (sem apagar; o banco recusa `DELETE`):** `update colaboradores set estado = 'saiu', atualizado_em = now() where slug = 'backfindr';` → a página passa a redirecionar para o Feed. Para voltar: `estado = 'ativo'`.
6. **Trocar a imagem do colaborador (SÓ se o fundador pedir; sem deploy; CODE):** `update colaboradores set imagem_url = '<NOVO_ENDEREÇO_HTTPS>', atualizado_em = now() where slug = 'backfindr' returning slug, imagem_url;` O endereço precisa ser `https` (a página ignora qualquer outro) e a imagem já precisa estar hospedada. A página é regenerada a cada 5 minutos: a nova imagem aparece em até 5 min, sem redeploy; o cartaz usa a imagem na próxima geração.
7. Observação: o `seed-backfindr.sql` antigo (código `HX7R`, já verificado) **não será usado**; este SQL o substitui.

### 4.2 Desligar o matching antes do teste — NAV
1. NAV: em Vercel → Settings → Environment Variables, abre `MATCHING_ATIVO` (Production).
2. NAV: confirma o valor anotado em 4.0.5 e o escreve na mensagem (valor para religar: `____`).
3. NAV: troca o valor para `0` (não apaga a variável) e salva.
4. FUN: autoriza com a passkey, se a Vercel pedir.

### 4.3 Ligar o programa só em Production e fazer o deploy — NAV
1. NAV: cria `COLABORADORES_ATIVO` = `1`, marcando **somente Production** (nem Preview, nem Development).
2. NAV: cria `NEXT_PUBLIC_COLABORADORES_ATIVO` = `1`, marcando **somente Production**.
3. FUN: autoriza com a passkey, se pedir.
4. NAV: Deployments → último deploy de produção → Redeploy (as `NEXT_PUBLIC_*` só valem em build novo; `MATCHING_ATIVO=0` também entra aqui).
5. CODE: espera a `impressao` mudar e roda `capturar` + `comparar`: agora `/@backfindr` deve abrir (200) e `/api/v1/colaboradores/validar?codigo=<código>` deve devolver `{"ok":true,"nome":"Backfindr"}`.

### 4.4 Roteiro de teste (produção, UMA ocorrência de teste)
1. CODE: abre `/@backfindr`: 200, «por Backfindr», imagem, descrição, link de volta ao Facebook, botões; **`noindex`** (tag `robots` e/ou cabeçalho); sem ocorrências.
2. CODE: confere que `/sitemap.xml` **não** contém `/@backfindr` (sem verificação a página fica fora do sitemap).
3. CODE: confere que `/@BackFindr` (maiúsculas) abre a mesma página e que a canônica é `/@backfindr`.
4. FUN: entra com a conta do próprio fundador (login por e-mail e senha).
5. FUN: em `/@backfindr`, toca em «Encontrei algo».
6. FUN: confere que o campo «Código do colaborador» já vem preenchido e mostra «Colaborador: Backfindr».
7. FUN: registra **uma** ocorrência «achado» com o título «TESTE PILOTO — pode ignorar», sem foto, categoria «outros», sem dado pessoal. Avisa o CODE assim que enviar.
8. CODE: confere que a ocorrência aparece no **Feed geral** (`/api/v1/feed?status=found`; o Feed guarda por 120 s) e na **página `/@backfindr`** (até 5 min).
9. CODE: confere que a página **continua `noindex`** e que o sitemap **continua sem** `/@backfindr` (a ocorrência já existe, mas a página não é verificada).
10. CODE: abre o **cartaz** da ocorrência (`/api/v1/objects/<código>/poster?format=square`, depois `vertical` e `a4`): deve trazer «Divulgado por Backfindr».
11. FUN: registra **uma segunda** ocorrência de teste **SEM código** (campo vazio, pelo fluxo normal, sem passar pela `/@backfindr`), título «TESTE PILOTO 2 — pode ignorar».
12. CODE: confere que a segunda foi gravada **igual à de hoje** (sem colaborador: `colaborador_id` e `colaborador_codigo` nulos), que o cartaz dela **não** tem «Divulgado por» e que ela não aparece na página `/@backfindr`.
13. CODE: confere que nenhuma ocorrência real foi tocada e que nenhum e-mail ou push saiu para outras pessoas (matching desligado).
14. CODE: arquiva as 2 ocorrências de teste (sem apagar), uma instrução por ocorrência, pelo código curto delas: `update objects set status = 'archived', updated_at = now() where qr_code = '<código>' returning qr_code, status;` (é o mesmo valor que a moderação usa; o dono não consegue arquivar sozinho).
15. CODE: espera até 5 min e confere que as duas sumiram do Feed e da página `/@backfindr`, e que o `colaborador_codigo` da primeira continua gravado (imutável).
16. **Regra de indexação × arquivada (por leitura do código, 24/11/2026; não testado em produção):** a contagem que decide a indexação (`comCodigo`, em `src/lib/colaboradores/feed.ts`) usa a mesma elegibilidade do Feed (`FEED_ELIGIBILITY_WHERE`: `is_public`, não legado, `status IN ('lost','found','stolen')`, com `qr_code`) e o sitemap usa a mesma regra. **Uma ocorrência arquivada NÃO conta** para tornar a página indexável. O passo 15 mostra isso na prática (a página deixa de listá-la).

### 4.5 Religar o matching — NAV
1. NAV: só depois do passo 14 do 4.4 (ocorrências de teste arquivadas), abre `MATCHING_ATIVO` (Production).
2. NAV: devolve o valor anotado em 4.0.5 (`____`) e salva.
3. FUN: autoriza com a passkey, se pedir.
4. NAV: Redeploy de produção.
5. CODE: espera a `impressao` mudar e confere que o programa continua ligado (`/@backfindr` 200 e `noindex`).
6. CODE: relata ao fundador: teste concluído, `/@backfindr` no ar sem verificação, matching religado.

### 4.6 Reversão completa (tudo volta ao comportamento de hoje) — qualquer momento
1. NAV: apaga `COLABORADORES_ATIVO` e `NEXT_PUBLIC_COLABORADORES_ATIVO` de Production.
2. NAV: devolve `MATCHING_ATIVO` ao valor anotado em 4.0.5.
3. FUN: autoriza com a passkey, se pedir.
4. NAV: Redeploy de produção.
5. CODE: espera a `impressao` mudar e roda `comparar`: `/@backfindr` volta a 404 (corpo da 404 de rotas internas é o já anotado).
6. CODE (opcional, sem apagar): `update colaboradores set estado = 'saiu', atualizado_em = now() where slug = 'backfindr';` (a linha nunca é apagada). As ocorrências de teste ficam arquivadas; o vínculo gravado nelas é imutável e sem efeito com o programa desligado.
7. Instant Rollback para `backfindr-3dtxeok5q` só se a produção mudar de comportamento de forma inesperada (FUN ou NAV).

---

## Pendências do @nome (reaproveitamento, PC-13; nada implementado)
**Pendências para depois do piloto (levantadas por LEITURA do código e do banco em 24/11/2026; NADA implementado):** (1) **Hoje o @nome nunca é reaproveitado, por construção:** índice único `uq_colaboradores_slug` em `lower(slug)` sobre TODAS as linhas, e o gatilho recusa `DELETE`; o `codigo_curto` também é único para sempre. A regra dos 12 meses exige um jeito de LIBERAR o @nome da linha antiga (sem apagá-la e mantendo o `id`, o vínculo das ocorrências e o código curto antigo), por exemplo índice único parcial só sobre linhas que não liberaram o @nome; **não existe hoje nenhum campo de «última atividade»** (poderia derivar de `objects.created_at` das ocorrências com `colaborador_id`; a definição de «atividade» é decisão do fundador). (2) **Estados hoje:** `ativo` (página), `suspenso` (307 para o Feed), `saiu` e `excluido` (308 permanente para o Feed). **Atenção:** o 308 é guardado pelos navegadores; se o colaborador que saiu reativar, quem já visitou pode continuar sendo mandado ao Feed. **Aceito pelo fundador em 24/11/2026 (PC-13): 307 para `saiu` (permite reativação) e 308 só para `excluido`; ainda NÃO implementado hoje (`carregarColaborador` devolve 308 para os dois); o teste do Passo 4 não depende disso.** (3) **Reativação não existe no código:** nenhum `UPDATE colaboradores` em `src/`; mudanças de estado só por SQL manual. Falta: o próprio colaborador reativar (`saiu` por vontade própria ou `suspenso`) e a trava de que `excluido` **nunca** volta (por exemplo um gatilho que recuse `excluido` → `ativo`). No piloto só existe o `@backfindr` (interno, sem conta própria). (4) **Vínculo das ocorrências antigas:** `objects.colaborador_id` (imutável por gatilho) aponta sempre para o colaborador anterior (correto), mas `objects.colaborador_codigo` guarda o TEXTO usado (`@nome` ou código curto) e esse texto passaria a designar outra pessoa; relatórios e repasses devem usar SEMPRE `colaborador_id`, nunca o texto. (5) **Código no resolvedor:** `resolverColaborador` já exige `estado = 'ativo'`, mas `carregarColaborador` busca por `lower(slug)` com `LIMIT 1` sem ordem; com duas linhas de mesmo @nome (a antiga liberada e a nova) a busca precisaria ignorar a linha liberada. (6) O código curto novo para a outra pessoa sai naturalmente de uma LINHA NOVA (id e código novos); o código é sorteado no SQL do Passo 4.1 (não há gerador no código da aplicação). (7) **Refina o desenho:** `DESENHO.md` (tabela `colaboradores`), a migration 026 e o `seed-backfindr.sql` dizem «o @nome nunca é reutilizado»; a decisão de 24/11/2026 passa a «reaproveitável só depois de 12 meses sem atividade do anterior». Os comentários desses arquivos ficam como estão até a implementação.

---

## Quem executa
| Passo | Quem |
|---|---|
| 0 | esta sessão (feito) |
| 1 (dump) | **o fundador** (só ele tem a conexão e a senha; esta sessão não pode e não deve trazer os dados para o chat) |
| 2 (026) | esta sessão, pelo conector, **depois** do passo 1 completo e de aviso |
| 3 (mesclas) | esta sessão (GitHub); a confirmação das variáveis da Vercel e a anotação do deploy: o fundador ou o Claude do navegador |
| 4 | só com nova ordem e com o fundador presente; **cada passo do roteiro 4.0 a 4.6 diz quem faz** (CODE = esta sessão; NAV = Claude do navegador; FUN = fundador) |
