# Verificação final na Vercel — roteiro em linguagem simples (versão final, 23/11/2026)

**NADA aqui foi executado. NADA é executado sem a ordem escrita do fundador.** O piloto (E0 a E3) está completo e aprovado, e **não será mesclado antes** desta verificação.

**O que vamos fazer, em uma frase:** criar, dentro do projeto «Resolve Tudo», uma «gaveta» separada (o schema `backfindr_teste`) com uma cópia **só da estrutura** do Backfindr (sem nenhum dado), apontar **somente a prévia da branch do piloto** para ela, testar tudo ali e, no fim, **apagar a gaveta** e conferir que o «Resolve Tudo» ficou exatamente como estava.

**Por que é seguro:** (1) todas as prévias da Vercel hoje usam o banco da produção; este roteiro cria uma variável nova **só para a branch do piloto**, sem tocar na variável existente; (2) o Storage do «Resolve Tudo» nunca é aberto nem consultado; (3) a gaveta fica em um schema próprio, com um papel próprio que **não tem acesso** a `public`, `storage` nem `auth`; (4) as chaves de e-mail, arquivos (R2), pagamento e métricas da prévia do piloto recebem valores inválidos, então nada chega a pessoas reais nem ao armazenamento da produção; (5) o banco do «Resolve Tudo» foi conferido antes (`LINHA-DE-BASE-ANTES.md`) e será conferido de novo depois; (6) os SQL e a sequência já foram **ensaiados num banco local** com volta exata à assinatura de antes.

## Como ler a tabela
- **Quem:** **CN** = o Claude do chat, com a extensão do Chrome (logada na Vercel, no Supabase e no GitHub); **F** = o fundador; **ESTA** = esta sessão (arquivos do repositório e leituras públicas, sem painel).
- **F presente?** «Sim» = o fundador precisa estar na frente do computador (login, senha, passkey, código de verificação ou uma decisão). «Não» = o CN faz sozinho, **depois da ordem escrita da fase**.
- **Parar se:** se isso acontecer, o CN **para na hora, não tenta consertar**, e avisa o fundador.

## Regras para quem executa (CN)
1. **Uma fase por vez.** Só começa a fase N depois de o fundador escrever «OK Fase N». No fim de cada fase, **para e relata** o que viu.
2. **Segredos nunca vão ao chat**: nem a senha do papel de teste, nem a cadeia de conexão, nem chaves. Não tirar captura de tela de campo de senha ou de variável aberta. Se precisar mostrar, mostrar só o **nome** da variável.
3. **Nunca editar nem apagar variável que já existe** na Vercel (principalmente a `DATABASE_URL` «All Environments»). Só **criar** as 13 variáveis novas (passos 5.2 a 5.14), sempre com o filtro de branch. Se a Vercel recusar criar a variável por já existir uma igual, **parar**.
4. **Conferir o nome do projeto no topo do Supabase antes de cada comando.** Os passos de escrita só rodam no **«Resolve Tudo»**. No projeto **«backfindr»** (produção) **só se roda o SELECT do passo 3.2 e leituras**; nada de `create`, `insert`, `update`, `delete`, `drop`, `alter` ali.
5. Nunca abrir a área **Storage** do «Resolve Tudo», nem a aba de arquivos, nem consultar `storage.*`.
6. Nada de fotos, pagamento, login com Google, convites ou envio de mensagens durante os testes.
7. Se qualquer tela pedir login, senha, passkey ou código: **parar e chamar o fundador** (passo marcado «Sim»).

## Antes de começar — decisões do fundador (uma por linha)
| # | Pergunta | Resposta |
|---|---|---|
| D1 | Posso começar a Fase 1 depois que você escrever «OK Fase 1»? | |
| D2 | O CN pode **gerar uma senha aleatória** para o papel de teste e usá-la no SQL e na variável da Vercel **sem mostrá-la**? (O papel e a senha somem na limpeza.) Se «não», o fundador digita a senha nos passos 2.4 e 5.1. | |
| D3 | A branch do piloto é `claude/backfindr-colaboradores-e3` e o PR #166 **não** será mesclado antes do fim deste roteiro? | |

---

## FASE 0 — Entrar nos painéis (nada muda)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 0.1 | Abrir a Vercel e conferir que está logado no projeto do Backfindr. | CN | Só se pedir login | pedir senha/passkey |
| 0.2 | Abrir o Supabase e conferir que está logado na organização, vendo os 3 projetos (backfindr, Resolve Tudo, m2r-media). | CN | Só se pedir login | pedir senha/passkey |
| 0.3 | Abrir o GitHub no repositório e confirmar que a branch `claude/backfindr-colaboradores-e3` e o PR #166 (rascunho) existem. | CN | Só se pedir login | PR não estar em rascunho |
| 0.4 | **Anotar a lista atual de variáveis da Vercel** (só os nomes e os ambientes de cada uma, em Settings → Environment Variables). Essa lista é a «linha de base da Vercel» para o passo 8.4. | CN | Não | — |

## FASE 1 — Conferir de novo o «Resolve Tudo» (só leitura)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 1.1 | Supabase → projeto **Resolve Tudo** → SQL Editor → «New query». | CN | Não | nome do projeto diferente |
| 1.2 | Colar o conteúdo de `catalogo-resolve-tudo.sql` (já corrigido) e rodar. | CN | Não | erro de SQL |
| 1.3 | Comparar o resultado com `LINHA-DE-BASE-ANTES.md`: consulta 2 e 3 vazias; consulta 5 sem `backfindr_teste`; consulta 6 com os mesmos totais e md5. | CN | Não | **qualquer** diferença (tabela, schema, papel, md5) |
| 1.4 | Relatar ao fundador e esperar «OK Fase 2». | CN | Sim (a resposta dele) | — |

## FASE 2 — Criar a «gaveta» no «Resolve Tudo» (primeira escrita; só dentro do «Resolve Tudo»)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 2.1 | Nova consulta no SQL Editor do **Resolve Tudo**; conferir o nome no topo. | CN | Não | nome diferente |
| 2.2 | Rodar: `create schema backfindr_teste;` | CN | Não | erro |
| 2.3 | Rodar: `create extension pg_trgm with schema extensions;` (a limpeza a remove) | CN | Não | erro |
| 2.4 | Rodar `create role backfindr_teste_app login password '<senha>' nocreatedb nocreaterole nobypassrls;` com a senha aleatória (≥ 32 caracteres) **sem mostrá-la**. (O editor guarda o histórico da consulta, inclusive a senha: por isso ela é descartável; o papel e a senha somem na limpeza, passo 8.3.) | CN (ou F, se D2 = «não») | Só se D2 = «não» | erro |
| 2.5 | Rodar: `alter role backfindr_teste_app set search_path = backfindr_teste, extensions;` | CN | Não | erro |
| 2.6 | Rodar: `grant usage, create on schema backfindr_teste to backfindr_teste_app;` | CN | Não | erro |
| 2.7 | Rodar: `grant usage on schema extensions to backfindr_teste_app;` | CN | Não | erro |
| 2.8 | Rodar: `grant backfindr_teste_app to postgres with set true;` | CN | Não | erro |
| 2.9 | Testar: `set role backfindr_teste_app; select current_user; reset role;` Deve mostrar `backfindr_teste_app`. | CN | Não | **falhar** (sem isso o teste não pode continuar) |
| 2.10 | Conferir: `select nspname, has_schema_privilege('backfindr_teste_app', nspname, 'USAGE') from pg_namespace where nspname in ('backfindr_teste','public','storage','auth') order by 1;` Esperado: `backfindr_teste` = true; `storage` = false; `auth` = false. | CN | Não | `storage` ou `auth` = true |
| 2.11 | Relatar e esperar «OK Fase 3». | CN | Sim (a resposta) | — |

## FASE 3 — Copiar só a estrutura do Backfindr (sem nenhum dado)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 3.1 | Supabase → projeto **backfindr** (produção) → SQL Editor → nova consulta. **Daqui em diante neste projeto só se roda o SELECT abaixo.** | CN | Não | — |
| 3.2 | Rodar `set search_path = public;` e, em seguida, o conteúdo de `gerar-esquema.sql` (é um único `select`; devolve uma única célula com o script). | CN | Não | pedir confirmação de «destrutivo» (não é: parar e avisar) |
| 3.3 | Copiar a célula `esquema` inteira (copiar célula). É só estrutura; não tem dado nenhum. | CN | Não | célula vazia |
| 3.4 | Voltar ao **Resolve Tudo** → nova consulta → colar, **antes do script**, estas 2 linhas: `set role backfindr_teste_app;` e `set search_path = backfindr_teste, extensions;`. | CN | Não | nome do projeto diferente |
| 3.5 | Rodar tudo. Se o editor recusar pelo tamanho, dividir o script nos pontos de linha em branco, **repetindo as 2 primeiras linhas no começo de cada parte**, na ordem original. | CN | Não | qualquer erro de SQL |
| 3.6 | Conferir a estrutura: no **backfindr** rodar `comparar-esquema-painel.sql` como está; no **Resolve Tudo** rodar o mesmo texto trocando `'public'` por `'backfindr_teste'`. | CN | Não | — |
| 3.7 | As 5 linhas (colunas, índices, restrições, gatilhos, funções) devem ser **idênticas** nos dois (mesmo md5 e mesma contagem). | CN | Não | **qualquer** diferença |
| 3.8 | Relatar e esperar «OK Fase 4». | CN | Sim (a resposta) | — |

## FASE 4 — Migration 026, seed e configuração mínima (no «Resolve Tudo»)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 4.1 | Nova consulta no **Resolve Tudo**: as 2 linhas (`set role`, `set search_path`) + o conteúdo de `src/db/migrations/026_colaboradores.sql`. Rodar. | CN | Não | erro |
| 4.2 | Nova consulta: as 2 linhas + o conteúdo de `docs/programa-colaboradores/seed-backfindr.sql`. Rodar. | CN | Não | erro |
| 4.3 | Nova consulta: as 2 linhas + `insert into payment_settings (key, value, description, is_secret) values ('payments_enabled', 'false', 'teste isolado: sem cobrança', false) on conflict do nothing;` Rodar. | CN | Não | a tabela não existir |
| 4.4 | Conferir: `select slug, codigo_curto, estado, interno from colaboradores;` → uma linha: `backfindr`, `HX7R`, `ativo`, `true`. | CN | Não | resultado diferente |
| 4.5 | Conferir que **nada** foi escrito no projeto **backfindr** (só foi lido). | CN | Não | — |
| 4.6 | Relatar e esperar «OK Fase 5». | CN | Sim (a resposta) | — |

## FASE 5 — Variáveis da prévia na Vercel (todas SÓ para a branch do piloto)
Em **todas** as variáveis abaixo: ambiente = **Preview** (somente), filtro **Git Branch = `claude/backfindr-colaboradores-e3`**. **Não** marcar Production, **não** marcar «All Environments».
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 5.1 | Supabase → **Resolve Tudo** → «Connect» → copiar a cadeia **Session pooler** (porta 5432). Montar a cadeia do app: usuário `backfindr_teste_app.<identificador do projeto>` e a senha do passo 2.4. **Não colar no chat.** | CN (ou F, se D2 = «não») | Só se D2 = «não» | não achar a cadeia |
| 5.2 | Vercel → Settings → Environment Variables → «Add». Nome `DATABASE_URL`, valor = a cadeia do passo 5.1, marcar **Sensitive**, ambiente **Preview**, **Git Branch** = a do piloto. Salvar. | CN | Não | a Vercel recusar por já existir `DATABASE_URL` |
| 5.3 | Criar `COLABORADORES_ATIVO` = `1` (Preview + branch do piloto). | CN | Não | — |
| 5.4 | Criar `NEXT_PUBLIC_COLABORADORES_ATIVO` = `1` (idem). | CN | Não | — |
| 5.5 | Criar `MATCHING_ATIVO` = `0` (idem). | CN | Não | — |
| 5.6 | Criar `RESEND_API_KEY` = `DESATIVADO-TESTE` (idem). | CN | Não | a Vercel recusar o valor |
| 5.7 | Criar `R2_ACCOUNT_ID` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.8 | Criar `R2_ACCESS_KEY_ID` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.9 | Criar `R2_SECRET_ACCESS_KEY` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.10 | Criar `MP_ACCESS_TOKEN` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.11 | Criar `STRIPE_SECRET_KEY` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.12 | Criar `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.13 | Criar `NEXT_PUBLIC_META_PIXEL_ID` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.14 | Criar `NEXT_PUBLIC_POSTHOG_KEY` = `DESATIVADO-TESTE` (idem). | CN | Não | — |
| 5.15 | Conferir a lista: as 13 novas (DATABASE_URL + 12) aparecem **somente** como «Preview — claude/backfindr-colaboradores-e3»; **as que já existiam não mudaram** (mesmo escopo e mesma data de edição). | CN | Não | **qualquer** variável antiga alterada |
| 5.16 | Relatar e esperar «OK Fase 6». | CN | Sim (a resposta) | — |
(São 13 variáveis novas no total: `DATABASE_URL` mais as 12 dos passos 5.3 a 5.14.)

## FASE 6 — Deploy da prévia e PROVA DE ISOLAMENTO (antes de qualquer cadastro)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 6.1 | Vercel → Deployments → o deploy mais recente da branch `claude/backfindr-colaboradores-e3` → «Redeploy» (as variáveis `NEXT_PUBLIC_*` só valem depois de um build novo). | CN | Não | — |
| 6.2 | Esperar o estado «Ready» e anotar o endereço da prévia da branch. | CN | Não | build falhar |
| 6.3 | Abrir (no navegador logado na Vercel) `<prévia>/api/v1/feed?limit=30`. **Esperado: lista VAZIA** (o banco de teste não tem ocorrências). | CN | Não | **aparecer qualquer ocorrência real**: **PARAR, apagar as variáveis do passo 5.2 e avisar: a prévia estaria na produção** |
| 6.4 | Abrir `https://backfindr.com/api/v1/feed?limit=30` (só leitura): **tem** ocorrências. Esse contraste é a primeira prova. | CN | Não | — |
| 6.5 | Abrir `<prévia>/@backfindr`: **abre** a página do colaborador (200). Em `https://backfindr.com/@backfindr` o esperado é **404**. | CN | Não | a prévia dar 404, ou a produção abrir |
| 6.6 | Na prévia, criar uma conta de teste (e-mail descartável do tipo `teste-isolado@exemplo.invalid`, senha de teste; **sem Google**). | CN | Não | erro 500 (conexão com o banco de teste) |
| 6.7 | Na prévia, registrar uma ocorrência «achado» com o título `TESTE-ISOLADO-<sufixo aleatório>`, **sem foto**. | CN | Não | — |
| 6.8 | Confirmar que a ocorrência aparece na prévia (Feed ou `api/v1/feed`; o Feed guarda 2 minutos) e **NÃO aparece** em `https://backfindr.com/api/v1/feed`. | CN | Não | aparecer na produção |
| 6.9 | No SQL Editor do **Resolve Tudo** (como o papel de teste): a linha está em `backfindr_teste.objects`. | CN | Não | — |
| 6.10 | No projeto **backfindr** (só leitura): `select count(*) from objects where title like 'TESTE-ISOLADO-%';` → **0**. | CN | Não | resultado diferente de 0 |
| 6.11 | Relatar a prova e esperar «OK Fase 7». | CN | Sim (a resposta) | — |

## FASE 7 — Testes do piloto (na prévia; sem fotos, sem pagamento, sem Google)
| Passo | O que fazer | Esperado |
|---|---|---|
| 7.1 | Abrir `/@backfindr`. | Página com «por Backfindr», botões e, se ainda não há ocorrência com o código, aviso de vazio e `noindex`. |
| 7.2 | Clicar «Encontrei algo» e registrar uma ocorrência pelo caminho da página. | O campo «Código do colaborador» vem preenchido e mostra «Colaborador: Backfindr»; a ocorrência é criada. |
| 7.3 | Registrar outra digitando `@backfindr`, outra com `HX7R` (minúsculas também), e outra **sem código**. | As com código gravam; a sem código grava normal. |
| 7.4 | Tentar `@naoexiste` e depois um colaborador suspenso (suspender o `@backfindr` no banco de teste, tentar, e voltar a «ativo»). | Recusado, nada criado; depois de reativar volta a aceitar. |
| 7.5 | No SQL Editor (Resolve Tudo, papel de teste) tentar trocar o código gravado numa ocorrência; depois trocar só o título. | A troca do código é **recusada**; a do título funciona. |
| 7.6 | Conferir o Feed geral e a página `/@backfindr`. | Todas as com código aparecem nos dois; a sem código só no Feed; a saída pública não mostra colaborador nem código. |
| 7.7 | Cadastrar um colaborador de teste com região e raio (SQL, no banco de teste) e ocorrências dentro e fora do raio. | Primeiro as com código; depois as da região dentro do raio; nenhuma de fora. |
| 7.8 | SEO: `/@backfindr` (verificado, com conteúdo) e um colaborador de teste **não verificado** com conteúdo. | `index` no primeiro; `noindex` no segundo; sitemap só com o elegível. |
| 7.9 | Estados: colocar um colaborador de teste em «suspenso» e em «saiu». | 307 e 308 para `/feed`; `@nome` inexistente = 404. |
| 7.10 | Cartaz: baixar os 3 formatos de uma ocorrência **com** código e de uma **sem** código (`.../api/v1/objects/<código>/poster?format=square`, `vertical`, `a4`). | O com código leva «Divulgado por …»; o sem código é igual ao de hoje. |
| 7.11 | Entrar com a conta **admin** de teste (criar no banco de teste) e abrir o painel. | Sem aviso de interruptores (os dois estão ligados). |
| 7.12 | Comparar com `backfindr.com` (só leitura): cadastro sem código, Feed, `/achei`, `/perdi`, login por e-mail, mapa e busca. | Funcionam como na produção. |
| 7.13 | Conferir fora do Backfindr: painel do Resend (nenhum e-mail novo), Cloudflare R2 (nenhum arquivo novo), Mercado Pago (nenhuma preferência nova), métricas (nenhum evento novo). | **Nada novo chegou.** |
| 7.14 | Relatar o resultado de cada item e esperar «OK Fase 8». | — |
Quem faz 7.x: **CN**, sem fundador presente (exceto login/passkey). **Parar se** qualquer coisa chegar à produção, ou aparecer erro de conexão com o banco.

## FASE 8 — Limpeza (SÓ depois da ordem escrita «Pode limpar»)
| Passo | O que fazer | Quem | F presente? | Parar se |
|---|---|---|---|---|
| 8.1 | Vercel: apagar, **uma por uma**, as 13 variáveis criadas nos passos 5.2 a 5.14 (todas «Preview — claude/backfindr-colaboradores-e3»). **Não apagar nada que já existia.** | CN | Não | a variável a apagar ter outro escopo |
| 8.2 | Vercel: conferir a lista contra a «linha de base da Vercel» do passo 0.4: **idêntica**. | CN | Não | qualquer diferença |
| 8.3 | Supabase → **Resolve Tudo** → rodar `limpar-schema-teste.sql` (apaga o schema `backfindr_teste` inteiro, o papel e a extensão `pg_trgm`). O painel pode pedir confirmação por ser «destrutivo»: **confirmar é a ordem do fundador desta fase**. | CN | Não (a ordem já foi dada) | erro |
| 8.4 | Rodar de novo `catalogo-resolve-tudo.sql` e comparar com `LINHA-DE-BASE-ANTES.md`: consultas 2 e 3 vazias; consulta 5 sem schema/papel de teste; **consulta 6 com os mesmos totais e md5**. | CN | Não | **qualquer** diferença |
| 8.5 | Conferir `backfindr.com` por leitura: Feed, `sitemap.xml` e `/@backfindr` (404) iguais ao começo. | CN | Não | qualquer diferença |
| 8.6 | Conferir o projeto **backfindr** (só leitura): nenhuma tabela nem coluna nova (a 026 **não** foi aplicada lá) e nenhuma ocorrência «TESTE-ISOLADO». | CN | Não | a 026 aparecer |
| 8.7 | O Storage do «Resolve Tudo» **nunca foi aberto** neste roteiro (confirmar no relato). | CN | Não | — |
| 8.8 | Registrar o resultado completo em `DESENHO.md`, `STATUS.md`, `BACKFINDR.md` e `DECISOES.md`, e mostrar ao fundador. | ESTA (ou CN) | Não | — |

## O que exige o fundador presente (resumo)
- Qualquer **login, senha, passkey ou código de verificação** que o Vercel, o Supabase ou o GitHub pedirem (passos 0.1 a 0.3 e onde mais aparecer).
- **As ordens escritas**: «OK Fase N» para cada fase e «Pode limpar» para a Fase 8.
- As **decisões D1, D2 e D3** no início.
- A **senha do papel de teste** e a **cadeia de conexão** só se o fundador responder «não» à D2.
Todo o resto (cerca de 95 % dos passos) o CN executa sozinho, uma fase por vez.

## Se algo der errado (volta atrás)
- **Fases 2 a 4:** rodar `limpar-schema-teste.sql` apaga tudo o que foi criado no «Resolve Tudo» (testado).
- **Fase 5:** apagar as variáveis criadas; a produção e as outras prévias nunca foram alteradas.
- **Fase 6:** se a prévia mostrar dados reais, **parar tudo**, apagar a variável `DATABASE_URL` da branch do piloto e só retomar depois de entender o motivo.
- **A qualquer momento:** a ordem do fundador «pare» vale mais que qualquer passo.

## Fora deste roteiro
Mesclar o piloto (E0 a E3), aplicar a 026 na produção, criar o `@backfindr` de verdade, ligar os interruptores em Production e o endurecimento do webhook do Mercado Pago: tudo isso depende de ordem escrita à parte e **não faz parte desta verificação**.
