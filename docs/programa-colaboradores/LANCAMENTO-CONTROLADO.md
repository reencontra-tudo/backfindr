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
| 4 — Ligar o piloto | NÃO autorizado |

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
**Passo 3 CONCLUÍDO (24/11/2026): #162 a #166 mesclados na `main` em ordem, um de cada vez, com interruptores DESLIGADOS (não existem na Vercel); produção sem mudança de comportamento; PARADO aqui, Passo 4 NÃO iniciado.** Commits de mescla: #162 `9c7928ac`, #163 `10ca3b2e`, #164 `40d309de`, #165 `936850c8`, #166 `a2a4ca4f` (`main` em `a2a4ca4`). Impressão de produção: `ce5fc691abb0904d` → `004efedc3c60b3b2` → `6fc480ae26040ada` → `5836d4974d10097c` → `cadd3a3456f870ae` → `ae027c42f88d3438`. Comparação final «antes × depois» (`lancamento/depois-passo3.json`): 13 rotas iguais, exceto (a) `/feed` (variação natural, similaridade 1,000) e (b) o CORPO da 404 de duas rotas internas novas e não linkadas, aceitas por ordem do fundador (`/colaborador/backfindr`: 404 com corpo quase vazio em vez da tela padrão; `/api/v1/colaboradores/validar`: 404 com corpo vazio; status continua 404); `/@backfindr` e `/@BackFindr` = 404 iguais ao «antes»; `sitemap.xml` e `robots.txt` iguais (nenhuma menção a colaborador); 4 cartazes públicos reais **idênticos byte a byte**; `POST /api/v1/objects` sem login = 401. Trechos inativos do programa aparecem no código do navegador (`bf_colab`, `/api/v1/colaboradores`, `colaborador_codigo`): anotados, não são comportamento (critério substituído, PC-11). Verificação de comportamento em navegador automatizado (perdido, achado e roubado com `?colab=teste123`, até o último passo, SEM enviar, 375 px e 1280 px): campo «Código do colaborador» ausente, nenhuma chave «colab» guardada, nenhuma requisição a `/api/v1/colaboradores`, nenhuma ocorrência criada; e, pelo Claude do navegador na produção, `/flow/lost` e `/flow/found` com `?colab=` sem nada guardado. Reversão disponível: Instant Rollback para `backfindr-3dtxeok5q` (não usado). **Aguarda a ordem escrita do fundador para o Passo 4.**

**AO FIM DO PASSO 3: PARAR e reportar.**

---

## PASSO 4 — Ligar o piloto (**NÃO EXECUTAR; só depois de nova ordem escrita**)
### 4.0 Decisões do fundador antes de ligar
| # | Decisão | Recomendação |
|---|---|---|
| D1 | **Matching durante o teste.** Hoje `MATCHING_ATIVO` está ligado em produção; uma ocorrência de teste nova pode **casar com uma ocorrência real e avisar o dono dela por e-mail e push**. | **DECIDIDO pelo fundador (24/11/2026): desligar `MATCHING_ATIVO` durante o teste do piloto e religá-lo logo depois.** Entra no roteiro (4.2 e 4.3, passo 8). |
| D2 | Quem cria as variáveis: o fundador ou o Claude do navegador (logado na Vercel). | — |
| D3 | Ocorrência de teste: aceita ficar **pública por alguns minutos** no Feed, na página `/@backfindr` e em `/objeto/<código>` (e eventos de métricas: Lead/Purchase não; `ocorrencia_publicada` sim). | Título que deixe claro que é teste e **sem dado pessoal e sem foto**. |
### 4.1 Preparar o banco (escrita na produção: só com ordem)
1. Aplicar `docs/programa-colaboradores/seed-backfindr.sql` (SHA-256 `cc0bd70cd6f45f3a05fb3850eec3165643961bd00734586e79145e4d45b59ebe`): cria o colaborador interno `@backfindr` (código curto `HX7R`, `interno`, verificado). **Antes de ligar os interruptores**, assim a página já existe quando o programa for ligado (e um 404 guardado por 5 minutos não atrapalha).
2. Conferir: `select slug, codigo_curto, estado, interno from colaboradores;` → `backfindr | HX7R | ativo | true`.
### 4.2 Variáveis em **Production** (Vercel → Settings → Environment Variables → só Production)
| Variável | Valor | Para quê |
|---|---|---|
| `COLABORADORES_ATIVO` | `1` | servidor: middleware, rotas, cadastro, página, sitemap, cartaz |
| `NEXT_PUBLIC_COLABORADORES_ATIVO` | `1` | navegador: campo do formulário e captura do `?colab=` (**fixada no build**) |
| `MATCHING_ATIVO` | `0` (**decidido: desligar durante o teste**; **alterar a existente**, anotando o valor antigo `1` para religar logo depois) | sem aviso a donos reais durante o teste |
**Os dois interruptores são ligados juntos**; o painel do admin mostra um aviso se divergirem. **Redeploy necessário** (as `NEXT_PUBLIC_*` só valem em build novo): Vercel → Deployments → Redeploy do deploy de produção mais recente. Esperar `impressao` mudar. Esperar até 5 minutos pelos 404 guardados (cache da página).
### 4.3 Roteiro de teste com `/@backfindr` (produção; uma única ocorrência de teste)
1. `GET /@backfindr` → 200, «por Backfindr», botões, sem ocorrências, `noindex`. `GET /api/v1/colaboradores/validar?codigo=HX7R` → `{"ok":true,"nome":"Backfindr"}`.
2. Entrar com a conta do **próprio fundador** (login por e-mail/senha). Na página `/@backfindr`, clicar «Encontrei algo» e registrar **uma** ocorrência «achado» de teste (ex.: «TESTE PILOTO — pode ignorar»), **sem foto**, categoria «outros», sem dado pessoal. O campo «Código do colaborador» vem preenchido e mostra «Colaborador: Backfindr».
3. Conferir (até 5 minutos): a ocorrência aparece no **Feed** (`/api/v1/feed?status=found`) e na **página `/@backfindr`** (e a página passa a `index, follow` por ser verificada e ter conteúdo); `sitemap.xml` ganha `/@backfindr`.
4. **Cartaz:** abrir `/api/v1/objects/<código>/poster?format=square` (e `vertical`, `a4`): leva «Divulgado por Backfindr».
5. **Cadastro SEM código** (uma segunda, igual à de sempre) **não é necessário em produção**: já foi provado byte a byte localmente; se o fundador quiser, repetir **uma** ocorrência de teste sem código e arquivar em seguida.
6. Conferir que **nenhum e-mail/push saiu para outras pessoas** (com D1 = desligar o matching) e que nenhum arquivo foi gravado no R2.
7. **Arquivar a(s) ocorrência(s) de teste:** painel admin (Objetos ou Moderação) → status «archived» (`PUT /api/v1/admin/objects/<id>` com `{"status":"archived"}`; o dono não consegue arquivar sozinho). Conferir que sumiu do Feed e da página `/@backfindr` (até 5 minutos). O código fica gravado nelas (imutável), sem efeito.
8. **Religar `MATCHING_ATIVO` ao valor antigo (`1`) logo depois do teste** (novo redeploy) e conferir (`impressao` muda); a ordem correta é: arquivar a(s) ocorrência(s) de teste (passo 7) **antes** de religar o matching.
### 4.4 Reversão do passo 4 (tudo volta ao comportamento de hoje)
1. Remover `COLABORADORES_ATIVO` e `NEXT_PUBLIC_COLABORADORES_ATIVO` de Production (e restaurar `MATCHING_ATIVO`) e **refazer o deploy**.
2. Conferir com `comparar` e `bundle`: `/@backfindr` = 404, sem trecho do programa no navegador.
3. O `@backfindr` no banco pode ficar (inofensivo) ou ir para `estado = 'saiu'`; as ocorrências de teste ficam arquivadas.

---

## Quem executa
| Passo | Quem |
|---|---|
| 0 | esta sessão (feito) |
| 1 (dump) | **o fundador** (só ele tem a conexão e a senha; esta sessão não pode e não deve trazer os dados para o chat) |
| 2 (026) | esta sessão, pelo conector, **depois** do passo 1 completo e de aviso |
| 3 (mesclas) | esta sessão (GitHub); a confirmação das variáveis da Vercel e a anotação do deploy: o fundador ou o Claude do navegador |
| 4 | só com nova ordem; variáveis e redeploy: o fundador ou o Claude do navegador; testes e arquivamento conforme 4.3 |
