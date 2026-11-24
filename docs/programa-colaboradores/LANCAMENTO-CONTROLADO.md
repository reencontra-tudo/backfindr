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
| 1 — Cópia de segurança | **PARCIAL — BLOQUEADO**: feitos o registro da assinatura do esquema e das contagens (leitura). **O dump completo (esquema e dados) NÃO pôde ser feito por esta sessão** (ver «Passo 1»). **Os passos 2 e 3 NÃO foram iniciados.** |
| 2 — Migration 026 | NÃO iniciado (depende do passo 1) |
| 3 — Mescla com interruptores desligados | NÃO iniciado (depende do passo 2) |
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

### 1.2 O que NÃO pôde ser feito por esta sessão: o dump completo (esquema e dados)
**Motivo (divergência: parar e reportar):**
- Esta sessão **não tem a cadeia de conexão nem a senha do banco** (só um conector de consulta, que roda SQL), então **não consegue rodar `pg_dump`**.
- Gerar o dump pelo conector significaria **trazer os dados (4.367 usuários, e-mails, telefones) para dentro desta conversa**: contraria a regra de nunca expor dados pessoais e não é um dump íntegro.
- O organização do Supabase está no plano **Free** (verificado em 23/11/2026), que, pelo que conheço, **não tem backup automático nem restauração por ponto no tempo** (**não confirmado** nas páginas lidas: conferir em Supabase → Database → Backups). Ou seja, **o dump manual é a única rede de segurança.**

### 1.3 Como o fundador faz o dump (no computador dele; a senha não vai para o chat nem para a linha de comando)
```bash
# 1) Pasta segura, fora do repositório, só do seu usuário
mkdir -p ~/backups-backfindr && chmod 700 ~/backups-backfindr
# 2) A senha vai numa variável digitada no próprio terminal (não cole em chat, não salve em arquivo):
read -s PGPASSWORD; export PGPASSWORD
# 3) Dump completo (esquema + dados) em formato «custom» (compactado, restaurável por tabela).
#    Use o host/usuário da tela «Connect» do Supabase (Session pooler, porta 5432, se o seu provedor de rede não tiver IPv6).
pg_dump "host=<HOST> port=5432 dbname=postgres user=<USUARIO> sslmode=require" \
  --format=custom --no-owner --no-privileges \
  --file="$HOME/backups-backfindr/backfindr-2026-11-24.dump"
unset PGPASSWORD
chmod 600 ~/backups-backfindr/backfindr-2026-11-24.dump
# 4) Integridade: tamanho, soma de verificação e índice do conteúdo
ls -l ~/backups-backfindr/backfindr-2026-11-24.dump
shasum -a 256 ~/backups-backfindr/backfindr-2026-11-24.dump > ~/backups-backfindr/backfindr-2026-11-24.dump.sha256
pg_restore --list ~/backups-backfindr/backfindr-2026-11-24.dump | grep -c "TABLE DATA"        # esperado: 56 tabelas com dados listados
```
**Conferência de integridade a mostrar ao Claude (sem dados):** o tamanho do arquivo, a soma `sha256`, e o número de linhas `TABLE DATA` (esperado 56). Opcional e mais forte: restaurar numa base **local descartável** (`createdb teste_restauracao && pg_restore --no-owner --no-privileges -d teste_restauracao <arquivo>`) e comparar `select count(*)` de `users`, `objects` e `matches` com a tabela acima (diferenças só por atividade ocorrida depois do dump).
**Cuidados:** o arquivo contém dados pessoais: fica só no computador do fundador (ou em cofre dele), com permissão `600`, **nunca** no repositório, no chat, em e-mail ou em pasta sincronizada pública. Apagar quando não for mais necessário.

### 1.4 Como restaurar, se for preciso
- **Só a migration 026 (o caso mais provável):** não precisa do dump; basta a **reversão** do passo 2.5 (as colunas e a tabela são novas e estarão vazias).
- **Uma tabela danificada:** `pg_restore --no-owner --no-privileges --data-only -t <tabela> -d "<banco>" <arquivo>` (depois de limpar a tabela, sob ordem do fundador).
- **O banco inteiro:** criar um projeto Supabase novo e `pg_restore --no-owner --no-privileges -d "<novo banco>" <arquivo>`; apontar `DATABASE_URL` da Vercel para o novo banco (decisão do fundador). O Supabase mantém extensões; conferir `pg_trgm` e `pgcrypto`.

### 1.5 Estado do passo 1
**NÃO COMPLETO.** Faltam o dump e a confirmação de integridade (1.3). **Sem isso os passos 2 e 3 não começam.** Se o fundador preferir seguir sem o dump (por decisão dele, escrita), a 026 é **aditiva e reversível** (colunas nulas e tabela nova, sem alterar dado existente); o risco residual é de um erro inesperado no `ALTER TABLE objects`, mitigado pelo `lock_timeout` e pela transação única (2.2), mas **a decisão de dispensar o dump é dele, não minha**.

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

---

## PASSO 3 — Mescla com os interruptores DESLIGADOS (só depois do passo 2 verificado)
### 3.1 Pré-condições (todas)
1. **`COLABORADORES_ATIVO` e `NEXT_PUBLIC_COLABORADORES_ATIVO` NÃO existem em Production.** Esta sessão **não consegue ler as variáveis da Vercel**: a confirmação é do **fundador ou do Claude do navegador** (Vercel → Settings → Environment Variables; procurar as duas; **nenhuma** das duas pode aparecer em Production nem em «All Environments»). Além disso, a verificação indireta pós-deploy (3.3) **pega** o erro: se alguma existisse, `/@backfindr` abriria e o `bundle` mostraria trechos.
2. **Anotar a implantação de produção atual** (`ce5fc691abb0904d` pela impressão; o fundador anota o identificador/URL dela na Vercel): é o destino do **Instant Rollback**.
3. Passos 1 e 2 completos e verificados. A `main` ainda em `5e0749c`. Nenhum PR da pilha com alteração nova não revisada.
### 3.2 Mescla (na ordem do 0.1, um PR de cada vez, com os comandos do 0.1)
Depois de **cada** mescla: esperar a implantação (a `impressao` muda), rodar a comparação rápida (`/`, `/feed`, `/@backfindr` = 404, `/robots.txt`). **Qualquer divergência = parar.**
### 3.3 Verificação depois do último deploy
- `capturar lancamento/depois-passo3.json` e `comparar antes-1.json depois-passo3.json antes-2.json`: **tudo OK**. Em especial **`/@backfindr` = 404**, `/colaborador/backfindr` = 404 e `/api/v1/colaboradores/validar` = **404** (iguais ao «antes»: com o interruptor desligado o programa não existe), `sitemap.xml` e `robots.txt` iguais.
- `bundle`: **nenhum** trecho do programa no código do navegador (a página de cadastro foi reconstruída com o código novo, mas o campo só existe com `NEXT_PUBLIC_COLABORADORES_ATIVO=1`).
- **Cadastro de ocorrência SEM código, por leitura de comportamento (nada é criado):** (a) `POST /api/v1/objects` sem login = **401 `{"detail":"Unauthorized"}`**, igual ao «antes»; (b) o HTML de `/flow/found` e o `bundle` iguais; (c) `GET /api/v1/objects/public` e o Feed iguais; (d) o cartaz de uma ocorrência **existente e pública** (`/api/v1/objects/<código>/poster?format=square`) devolve **200 PNG**, e **o mesmo arquivo que antes** (**já guardados** em `lancamento/antes-cartazes.json`: 4 imagens de 2 ocorrências públicas reais, estáveis em dois pedidos; conferir com `node tools/comparar-producao.mjs cartazes docs/programa-colaboradores/lancamento/antes-cartazes.json`: com o programa desligado o cartaz é idêntico byte a byte). **Não** criar ocorrência, conta, boost nem pagamento.
- Admin e painel: não alterados com o programa desligado (o aviso de interruptores não aparece); só se o fundador quiser, conferir logado.
- O banco: as contagens do passo 1.1 pela regra de não diminuir.
### 3.4 Reversão do passo 3
1. **Vercel → Deployments → Instant Rollback** para a implantação anotada em 3.1 (imediato, sem git). A `main` continua com as mesclas, mas a produção volta ao código de antes.
2. Para desfazer na `main`: abrir **PRs de reversão** (`git revert -m 1 <commit de mescla>`, do último para o primeiro) e mesclá-los sob ordem do fundador. **Não** fazer push direto na `main`.
3. A 026 **não** precisa ser revertida (aditiva).
**AO FIM DO PASSO 3: PARAR e reportar.**

---

## PASSO 4 — Ligar o piloto (**NÃO EXECUTAR; só depois de nova ordem escrita**)
### 4.0 Decisões do fundador antes de ligar
| # | Decisão | Recomendação |
|---|---|---|
| D1 | **Matching durante o teste.** Hoje `MATCHING_ATIVO` está ligado em produção; uma ocorrência de teste nova pode **casar com uma ocorrência real e avisar o dono dela por e-mail e push**. | **Desligar `MATCHING_ATIVO` durante o teste** (variável `MATCHING_ATIVO=0`, no mesmo redeploy de 4.2) e religar depois; ou escolher um título e uma categoria que não casem com nada (menos seguro). |
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
| `MATCHING_ATIVO` | `0` (se D1 = desligar; **alterar a existente** e anotar o valor antigo para religar) | sem aviso a donos reais durante o teste |
**Os dois interruptores são ligados juntos**; o painel do admin mostra um aviso se divergirem. **Redeploy necessário** (as `NEXT_PUBLIC_*` só valem em build novo): Vercel → Deployments → Redeploy do deploy de produção mais recente. Esperar `impressao` mudar. Esperar até 5 minutos pelos 404 guardados (cache da página).
### 4.3 Roteiro de teste com `/@backfindr` (produção; uma única ocorrência de teste)
1. `GET /@backfindr` → 200, «por Backfindr», botões, sem ocorrências, `noindex`. `GET /api/v1/colaboradores/validar?codigo=HX7R` → `{"ok":true,"nome":"Backfindr"}`.
2. Entrar com a conta do **próprio fundador** (login por e-mail/senha). Na página `/@backfindr`, clicar «Encontrei algo» e registrar **uma** ocorrência «achado» de teste (ex.: «TESTE PILOTO — pode ignorar»), **sem foto**, categoria «outros», sem dado pessoal. O campo «Código do colaborador» vem preenchido e mostra «Colaborador: Backfindr».
3. Conferir (até 5 minutos): a ocorrência aparece no **Feed** (`/api/v1/feed?status=found`) e na **página `/@backfindr`** (e a página passa a `index, follow` por ser verificada e ter conteúdo); `sitemap.xml` ganha `/@backfindr`.
4. **Cartaz:** abrir `/api/v1/objects/<código>/poster?format=square` (e `vertical`, `a4`): leva «Divulgado por Backfindr».
5. **Cadastro SEM código** (uma segunda, igual à de sempre) **não é necessário em produção**: já foi provado byte a byte localmente; se o fundador quiser, repetir **uma** ocorrência de teste sem código e arquivar em seguida.
6. Conferir que **nenhum e-mail/push saiu para outras pessoas** (com D1 = desligar o matching) e que nenhum arquivo foi gravado no R2.
7. **Arquivar a(s) ocorrência(s) de teste:** painel admin (Objetos ou Moderação) → status «archived» (`PUT /api/v1/admin/objects/<id>` com `{"status":"archived"}`; o dono não consegue arquivar sozinho). Conferir que sumiu do Feed e da página `/@backfindr` (até 5 minutos). O código fica gravado nelas (imutável), sem efeito.
8. Religar `MATCHING_ATIVO` ao valor antigo (novo redeploy).
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
