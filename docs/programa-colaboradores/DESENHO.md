# Programa de Colaboradores — diagnóstico e desenho (23/11/2026)

**Estado (23/11/2026): desenho APROVADO PARCIALMENTE pelo fundador: só o piloto, etapas E0 a E3, sem nenhuma parte financeira (PC-02). Etapas E4 a E8 SUSPENSAS. O estado real de cada etapa está na seção 9.** (Texto original do desenho, preservado: «DESENHO PARA APROVAÇÃO. Nada foi construído…» valia até a aprovação.) Este documento só registra o que foi verificado e o que se propõe. As regras de negócio vieram do fundador (Marcos, 23/11/2026) e estão registradas em `DECISOES.md` (PC-01); este desenho é a PC-02 (PENDENTE de aprovação).

Convenções: **VERIFICADO** = lido no código ou consultado no banco (somente leitura, agregado) em 23/11/2026. **HIPÓTESE** = não verificado. Estimativas são minhas, não medidas.

---

## 0. Em uma tela

| Pergunta | Resposta curta |
|---|---|
| Dá para fazer sem refazer o que existe? | Sim. O cadastro, o Feed, o cartaz e o pagamento ficam; o que entra é aditivo (tabelas novas, 2 colunas novas em `objects`, rotas novas). |
| Onde mora o maior risco? | No dinheiro. O webhook do Mercado Pago de hoje **não é idempotente, não valida assinatura, responde 200 mesmo com erro e ignora estorno** (VERIFICADO). Comissão não pode ser construída em cima dele sem uma camada nova. |
| Segundo maior risco? | O cadastro de ocorrência: o servidor grava **qualquer chave desconhecida do corpo** dentro de `category_fields` (VERIFICADO). O código do colaborador precisa ser lido de forma explícita e validado, nunca "passar junto". |
| O que o piloto exige? | Etapas E0 a E3 (atribuição + página + cartaz, **sem dinheiro**), com a página do próprio Backfindr como primeiro colaborador. ≈ 8,5 a 12 dias de trabalho. |
| Total? | ≈ 29 a 37 dias de trabalho em 9 etapas pequenas, cada uma entregável sozinha. |
| O que precisa de decisão do fundador? | 14 pontos (seção 7), 5 deles antes de qualquer código. |

---

## 1. Fontes consultadas (regra primordial do CLAUDE.md)

**Consultadas:** `DECISOES.md` (inteiro; séries Q, B, C, F), `STATUS.md`, `BACKFINDR.md` (§1 a §12 e buscas por pagamento, cartaz e analytics), `docs/FEED-E-ACHEI-REGRAS-VIGENTES.md`, código em `src/` (rotas de objetos, boost, checkout, webhook, cartaz, Feed, middleware, autenticação, admin, rastreamento, política de privacidade), banco de produção (somente leitura, agregado: estrutura de tabelas, contagens).

**Não consultadas:** documentação oficial do Mercado Pago (formato exato de estorno, assinatura do webhook, taxas); painel do Mercado Pago; comportamento real do roteamento com `@` na Vercel; Safari/iPhone; textos jurídicos. Onde isso pesa está marcado HIPÓTESE.

**Decisões já registradas que este desenho respeita ou toca**

| Registro | O que diz | Como o desenho se comporta |
|---|---|---|
| F-01 / regras vigentes do Feed | Feed = outra forma de ver as mesmas ocorrências; sem legado; quem entra é uma regra única (`FEED_ELIGIBILITY_WHERE`) | A página do colaborador reutiliza a mesma regra de elegibilidade; o Feed `/feed` não muda. |
| B-25, B-27, B-28, Q-20, Q-26 | Legado fica, nunca sai de mapa/busca/sitemap; não é base de envio; legado sem conta atualizada é só leitura | Legado fora da página do colaborador (como no Feed). Legado só leitura **não consegue cadastrar**, logo não gera código (ver §7, ponto 9). |
| Q-18, Q-19 | E-mail de serviço vs marketing; nenhum marketing sem consentimento | E-mails do programa são de **serviço** (verificação, saque). Nenhum e-mail de captação. |
| F-33, F-34, F-35 | Token/credencial nunca na URL para rastreadores; Clarity e PostHog limpam URL | O código do colaborador **não é credencial**, mas o desenho não cria cookie novo nem identificador persistente (ver §3.3). |
| F-22, regras de endereço | Saídas públicas mostram só «bairro, cidade - UF» | Página e painel usam as mesmas saídas públicas (`toPublicItem`). |
| Regras do Feed, «Regras que não mudam» | «Nada de dado novo no banco para o Feed e o `/achei`» | **Conflito explícito:** o programa grava dado novo em `objects`. Precisa de refinamento escrito do Marcos (§7, ponto 1). |

---

## 2. Diagnóstico da arquitetura atual

### 2.1 Cadastro de ocorrência (`POST /api/v1/objects`, `src/app/api/v1/objects/route.ts`)
- VERIFICADO: o corpo é desestruturado em campos conhecidos e **o resto (`...categoryFields`) é gravado em `category_fields` (JSONB)**. Hoje só a categoria documento limpa essas chaves. Uma chave nova como `colaborador` seria persistida sem validação se ninguém a tratar.
- VERIFICADO: a validação é manual (não usa zod no servidor); limites por plano (`PLAN_MAX_OBJECTS`); aviso de objeto parecido responde 409 e o cliente reenvia o **mesmo corpo** com `confirm_duplicate: true`; geocodificação por Mapbox; eventos `objectCreated/Published/Indexed`; fila de posts sociais; matching atrás do interruptor `MATCHING_ATIVO`.
- VERIFICADO: o código público da ocorrência é `qr_code` (8 caracteres sorteados com `Math.random`, `UNIQUE`). A coluna `unique_code` existe, mas está **nula em todas as 2.227 linhas** (a rota a mapeia para `qr_code`).
- VERIFICADO: o formulário `/dashboard/objects/new` (react-hook-form + zod no cliente) recebe `intent` e `prefill_*` pela URL. A lista de parâmetros que sobrevive ao login é **fechada** em `src/lib/intencaoCadastro.ts` (PR #157). A tela de cadastro (`/auth/register`) lê os mesmos parâmetros e os reenvia ao formulário.
- HIPÓTESE: o login com Google perde `intent` e `prefill_*` (nenhuma menção em `src/app/api/v1/auth` nem em `auth/google-success`). Se for verdade, o código do colaborador também se perderia por esse caminho, a menos que o desenho o guarde no navegador (§3.3).

### 2.2 Feed
- VERIFICADO: `getRankedFeed` (`src/lib/feed/query.ts`) lê até 1.000 candidatos com colunas fixas, guarda em memória por 120 s, aplica faixas de região **por cidade/UF** (não por raio em km) e entrega só campos públicos (`toPublicItem`: nunca `user_id`, e-mail, coordenadas, telefone).
- VERIFICADO: `/feed` é estático com revalidação de 5 min, indexável; `/feed/pagina/N` leva `noindex, follow`; canonical sempre `/feed`.
- Implicação: "primeiro as ocorrências com o código, depois as da região (raio configurável)" é **uma consulta nova**, não uma variação do `getRankedFeed`. Deve reutilizar `FEED_ELIGIBILITY_WHERE` e `toPublicItem`, e **não alterar** a função existente.

### 2.3 "Ampliar alcance" (boost) e Mercado Pago
| Item | O que existe (VERIFICADO) |
|---|---|
| Telas | `dashboard/objects/[id]` (compra), `dashboard/billing`, `checkout/success`, `pricing`; o texto "Ampliar alcance" está em `ActivityCenterCard`. |
| Duas rotas de compra | `POST /api/v1/boost` (verifica que o objeto é do usuário; preço de `payment_settings` com padrão 9,90 / 24,90 / 14,90) e `POST /api/v1/checkout/mercadopago` (**não verifica dono do objeto**; aceita usuário `anonymous`; preços fixos no código). Os dois gravam `metadata` (`user_id`, `object_id`, `boost_type`, `days`) na preferência. |
| Modo teste | Se `payments_enabled` não for `true`, `POST /boost` **ativa o boost sem cobrança**, com `provider='test'`. |
| Webhook (`/api/v1/webhooks/mercadopago`) | Só trata `type=payment` com status `approved`, consultando a API do MP. **Sem validação de assinatura** (a chave `mp_webhook_secret` existe em `payment_settings` e **nenhum código a usa**). **Sem idempotência**: cada notificação repetida faz novo `INSERT` em `boosts` (não há índice único em `provider_ref`). **Qualquer erro responde 200** (o MP não reenvia). **Estorno, cancelamento e contestação são ignorados** (status ≠ approved retorna "not_approved"): o boost continua ativo. |
| Tabela `boosts` | `object_id, user_id, type, status, amount_paid, provider, provider_ref, starts_at, expires_at`; índices só em `object_id` e `expires_at`; RLS ligado. Não existe estado "estornado". |
| Dados de produção (agregado) | **2 boosts em toda a vida**, ambos `mercadopago`, ativos, soma R$ 49,80. `payments_enabled = true`; `mp_mode = test` em `payment_settings`. HIPÓTESE: não sei se o `MP_ACCESS_TOKEN` real da Vercel é de teste ou de produção; **não afirmo que esses R$ 49,80 sejam dinheiro real**. |
| Mensalidade | Webhook também ativa plano (`plan`). Fora do escopo (comissão só em "ampliar alcance"). |

### 2.4 Imagem de divulgação
- VERIFICADO: `GET /api/v1/objects/[id]/poster?format=square|vertical|a4` (680 linhas, `next/og` + Sharp). O mesmo endpoint, com `?publico=1`, gera a pré-visualização pública (`og:image` do `/objeto/[code]`) já com endereço reduzido. Há 3 modelos de layout.
- VERIFICADO: a fila de posts sociais (`social_posts`) é alimentada em segundo plano a cada cadastro, mas **a tabela `social_posts` não existe no banco de produção** (consulta `to_regclass` = nulo). HIPÓTESE: os posts automáticos hoje falham em silêncio. A "imagem de divulgação" que funciona é o cartaz baixado/compartilhado.

### 2.5 Autenticação e papéis
- VERIFICADO: JWT em cookies `access_token`/`refresh_token` (não HttpOnly, lidos pelo cliente) e em cabeçalho; papéis em `users.role` (produção: `user` 4.365, `admin` 1, `super_admin` 1); `adminGuard` resolve o usuário no banco a cada chamada. `b2b_admin` existe para o portal `/parceiro`.
- Implicação: **colaborador não é papel.** É uma linha em tabela própria ligada a `users.id`. Assim qualquer conta comum pode ser colaborador sem mudar permissões.
- Não existe tabela de auditoria, de lançamentos financeiros, de saques nem de consentimento (consulta ao catálogo de tabelas). Existem `object_events` (eventos por objeto), `notifications` e `send_throttle_events`.

### 2.6 Rastreamento, privacidade e URL
- VERIFICADO: o `middleware.ts` (roda em todas as rotas exceto `api`, `_next` e imagens) grava o cookie `bf_acquisition` (90 dias; UTM, referrer e `landing_page`) e o cadastro copia esses campos para `users`. Isso já é "rastreamento prolongado"; **o desenho não o reutiliza** para atribuição.
- VERIFICADO: a política de privacidade diz «Utilizamos apenas cookies essenciais… Não utilizamos cookies de rastreamento ou publicidade», o que já contradiz GA4/Meta/PostHog/Clarity (pendência registrada, Q-19/Q-21). O programa acrescenta dados (canal, chave PIX, aceite) que a política **não cobre**.
- VERIFICADO: PostHog, GA4, Meta e Clarity têm guardas de URL com token (`trackingGuard.ts`); eventos não levam dado pessoal.

### 2.7 Roteamento, SEO e conceito de parceiro
- VERIFICADO: Next 14.2; `middleware.ts` único; `robots.ts` libera `/parceiro` (portal B2B) e bloqueia `/u/`; `sitemap.ts` monta a lista por API. Não existe nenhuma rota que comece com `@`.
- Pastas com `@` no App Router são "slots" de rotas paralelas, **não segmentos de URL** (documentação do Next; não testado aqui). Por isso `/@nome` precisa de reescrita.
- Conceito de parceiro hoje: **só B2B** (`b2b_partners`, role `b2b_admin`, `/parceiro/*`, `/b2b/cadastro`). Nada de afiliado, indicação, comissão ou código promocional (busca no código e no catálogo de tabelas).

### 2.8 Números de contexto (produção, agregado, 23/11/2026)
| Medida | Valor |
|---|---|
| Ocorrências de usuários (sem legado e sem sinais públicos) | 40 (12 nos últimos 30 dias) |
| Sinais públicos / legado | 185 / 2.002 |
| Usuários novos nos últimos 30 dias | 14 |
| Compras de "ampliar alcance" já feitas | 2 |

Conclusão de contexto: o gargalo é visitante, como o fundador afirma. Ao mesmo tempo, **a conta do saque mínimo** merece atenção: 25 % de R$ 24,90 = R$ 6,225 por compra, então R$ 50 pedem ≈ 9 compras de R$ 24,90 (ou ≈ 21 de R$ 9,90). Com o volume atual, quase nenhum colaborador chegará ao saque nos primeiros meses (§7, ponto 5).

---

## 3. Desenho proposto

### 3.1 Princípios
1. **Aditivo e desligado por padrão.** Tudo atrás de um interruptor `COLABORADORES_ATIVO` (ausente = desligado), no mesmo molde de `MATCHING_ATIVO`. Desligado, nenhum fluxo existente muda.
2. **Atribuição é um fato gravado na ocorrência, uma vez.** Sem vínculo usuário↔colaborador.
3. **Dinheiro só por lançamentos imutáveis**; saldo é sempre soma, nunca campo editável.
4. **O servidor decide tudo**: validade do código, valor da compra, percentual, elegibilidade.
5. **Não tocar no que funciona**: o ramo atual de ativação do boost no webhook e o `getRankedFeed` permanecem como estão; a comissão entra numa camada separada e isolada (falha nela nunca impede o boost).

### 3.2 Modelo de dados (tudo novo é aditivo; RLS ligado e sem política, como as migrations 018/019)
| Tabela / coluna | Para quê | Pontos-chave |
|---|---|---|
| `colaboradores` | Um por canal | `id`, `user_id` (único no lançamento), `slug` (único sem diferenciar maiúscula; 3–30; `a-z0-9-`), `codigo_curto` (único; 4 caracteres de alfabeto sem 0/O/1/I; sorteio com `crypto`; cresce para 5 se faltar espaço), `nome`, `descricao`, `imagem_url` (arquivo próprio no R2, nunca link externo), `canal_url`, `regiao` (cidade/UF + `lat/lng` + `raio_km`), `modalidade` (`comunidade_criador` no lançamento; demais valores previstos e bloqueados), `estado` (`ativo`, `suspenso`, `excluido`, `saiu`), `verificado_em`/`verificado_por`, `interno` (verdadeiro para o Backfindr: nunca recebe comissão). Linha **nunca apagada**; `slug` nunca reutilizado. |
| `objects.colaborador_id` e `objects.colaborador_codigo` | Atribuição por ocorrência | Nulos por padrão (adicionar coluna nula é instantâneo no Postgres, HIPÓTESE de tempo em produção: medir na E0). `colaborador_codigo` guarda o texto do código **como foi aceito** (rastro mesmo se o colaborador sair). FK `ON DELETE RESTRICT`. Índice parcial `WHERE colaborador_id IS NOT NULL`. **Gatilho no banco** (`BEFORE UPDATE`) que **recusa qualquer mudança** nessas duas colunas depois do `INSERT` (inclusive de nulo para valor). |
| `colaborador_verificacoes` | Fila de verificação do canal | código de verificação (`BF-XXXX-XXXX`, distinto do código curto), estado (`pendente`, `aprovada`, `recusada`), responsável, data, motivo. Troca de canal cria nova linha e suspende a liberação. |
| `colaborador_lancamentos` | Livro financeiro, **só `INSERT`** (gatilho recusa `UPDATE`/`DELETE`) | `tipo` (`comissao`, `estorno`, `saque_reservado`, `saque_pago`, `saque_cancelado`, `ajuste_admin`, `cancelamento_exclusao`), `valor_centavos` (inteiro, com sinal), `moeda`, `boost_id`, `pagamento_ref`, `percentual_aplicado` e `base_centavos` (cópia do que valia na hora), `disponivel_em`, `chave_idempotencia` **única** (`tipo + pagamento_ref`), `motivo`, `criado_por`, `criado_em`. Saldo pendente/disponível = consulta (visão), nunca coluna. |
| `colaborador_saques` | Pedido de saque | valor, `chave_pix` (cifrada em repouso; tela mostra só o final), estados `solicitado` → `pago`/`recusado`/`cancelado`, datas, responsável, comprovante opcional. Um pedido aberto por colaborador. |
| `pagamento_eventos` | Caixa de entrada do webhook | `provider`, `pagamento_id`, `status`, resumo mínimo, `processado_em`, `tentativas`; **único** em (`provider`, `pagamento_id`, `status`). Dá idempotência e permite reprocessar. |
| `programa_config` | Regras editáveis no admin sem deploy | chave/valor com versão e vigência: `comissao_percentual` (25), `saque_minimo_centavos` (5000), `prazo_liberacao_dias`, `raio_padrao_km`, `exclusao_cancela_saldo` (verdadeiro), `prazo_saque_dias_uteis` (10). Mudança só vale daqui para frente. |
| `politica_aceites` | Aceite da política | `user_id`, `versao`, `aceito_em`. Sem IP e sem dispositivo (minimização). |
| `auditoria` | Trilha genérica, só `INSERT` | `ator_id`, `acao`, `alvo_tipo/id`, `antes/depois` resumidos, `motivo`, `criado_em`. Cobre estado do colaborador, verificação, saque, ajuste e configuração. |
| `colaborador_visitas_dia` (opcional, E8) | Visitas por dia | contagem agregada por colaborador e dia, **sem IP, sem cookie, sem identificador**. Ver §3.8. |

**Escopo do gatilho da migration 026 (confirmado em 23/11/2026, pedido do fundador).** O gatilho é `BEFORE UPDATE OF colaborador_id, colaborador_codigo ON objects ... WHEN (OLD.colaborador_id IS DISTINCT FROM NEW.colaborador_id OR OLD.colaborador_codigo IS DISTINCT FROM NEW.colaborador_codigo)`. Consequências, todas verificadas:
1. **Só age sobre as colunas novas do programa.** `UPDATE OF <colunas>` faz o Postgres nem considerar o gatilho num `UPDATE` que não cita essas colunas. Os 26 comandos `UPDATE objects` do código (status, edição, matching e aviso de «encontrei», boost e webhook do Mercado Pago, imagens, categoria, descrição, busca, rotinas do admin) **nenhum cita as colunas do programa e nenhum usa lista de colunas dinâmica** (busca em `src/` em 23/11/2026).
2. **Custo zero para `UPDATE`s normais.** Teste (`tests/colaboradores-e2-guardas.test.ts`, com `track_functions`): depois de `UPDATE`s de status, edição, boost, aviso de «encontrei» e imagens, em ocorrências com e sem colaborador, a função do gatilho foi executada **0 vezes**; listar as colunas do programa sem mudar o valor também executa **0 vezes** (cláusula `WHEN`); só uma mudança real chega à função e é recusada.
3. **Nenhum gatilho em `INSERT` ou `DELETE` de `objects`** (o teste confere os bits do tipo do gatilho). No `INSERT`, a única diferença é a verificação da chave estrangeira, e só quando `colaborador_id` não é nulo.
4. Reversão e idempotência testadas; a migration **não está aplicada em nenhum banco compartilhado com a produção**.
Nada a ajustar: o gatilho já era assim.

### 3.3 Código do colaborador: regra central
- **Formas aceitas:** `@nome` (com ou sem `@`, qualquer caixa) ou `codigo_curto`. Os dois resolvem para o mesmo `colaborador_id`.
- **Validação** (`GET /api/v1/colaboradores/validar?codigo=…`, pública, resposta única): devolve só `{ ok, nome }` para ativo e `{ ok:false }` para inválido **e** inativo (mesma resposta; não confirma existência). Limite por origem usando a tabela de controle já existente (`send_throttle_events`), não memória de instância.
- **Preenchimento automático sem rastreamento prolongado:** o link `/@nome` (e os botões da página) levam `?colab=<código>` aos fluxos já existentes (`/flow/*`, `/auth/register`, `/dashboard/objects/new`). O código só viaja **na URL desta jornada** e, para sobreviver ao cadastro e ao login com Google (HIPÓTESE do §2.1), fica em `sessionStorage` **apenas até o envio da ocorrência ou o fechamento da aba**. Nenhum cookie novo, nenhum uso do `bf_acquisition`. O código não é credencial (é público, como o `@nome`), então o desenho **não** o põe na lista de bloqueio do `trackingGuard`; ele seguirá na URL para os rastreadores como qualquer parâmetro. Isso fica como decisão a confirmar (§7, ponto 12).
- **No formulário:** campo opcional e discreto «Código do colaborador» **no passo final**, em todos os modos (registrar, proteger, «+»). Ao digitar, valida no servidor e mostra «Colaborador: <nome> — confirmar». Pré-preenchido quando veio por link/código; a pessoa pode apagar. Código inválido ou inativo **não bloqueia o cadastro**: o campo mostra o aviso e a ocorrência só é enviada **sem código** se a pessoa limpar o campo (nunca em silêncio).
- **No servidor (`POST /objects`):** lê **explicitamente** `colaborador_codigo`, **remove-o** de `categoryFields` antes de qualquer outro uso, resolve no banco, exige colaborador `ativo`, e grava `colaborador_id` e `colaborador_codigo` **no mesmo `INSERT`**. Se o código vier inválido ou inativo: responde erro claro (`CODIGO_COLABORADOR_INVALIDO`) e **não cria**; a tela explica e deixa limpar o campo. O reenvio do 409 (`confirm_duplicate`) reaproveita o mesmo corpo, então o código viaja junto. Ocorrência feita **pela conta do próprio colaborador** aceita o código, mas não gera comissão (§3.6).
- **Imutabilidade:** gatilho do banco (acima) + nenhuma rota de edição toca essas colunas (a edição `PUT /objects/[id]` usa lista própria de colunas, VERIFICADO; um teste garante que continua assim).
- **Fora do cálculo:** matching, similares e Feed `/feed` **não leem** estas colunas.

### 3.4 Rotas e telas
| Superfície | Rota | Observação |
|---|---|---|
| Página do colaborador | URL pública `/@nome` → reescrita para `/colaborador/[slug]` | Reescrita por middleware (regex `^/@([a-z0-9-]{3,30})$`), com alternativa `rewrites()` do `next.config.js`; a E0 decide testando em `next start` **e** em prévia da Vercel. O acesso direto a `/colaborador/x` **mostra a mesma página com a canônica apontando para `/@x`** (desvio do desenho original, que previa um redirecionamento 308: ver `e2/NAO-REGRESSAO.md` §6, item 3). A parte `/@` não atrapalha os rastreadores existentes (o middleware atual continua rodando para ela). |
| Seja colaborador | `/colaborador/seja` (nome final a decidir) | Só por link direto; **sem menu, sem rodapé, sem sitemap, `noindex`**; não entra em `robots.ts` (um `Disallow` revelaria o endereço). |
| Painel do colaborador | `/dashboard/colaborador/*` | Atrás do login; mostra só ocorrências com o código **pela saída pública** (`toPublicItem`), saldo, verificação, saque, troca de canal, saída. |
| Admin | `/admin/colaboradores/*` | Mesmo `adminGuard`; ver §3.7. |
| APIs | `GET /api/v1/colaboradores/validar`, `GET /api/v1/colaboradores/[slug]/feed`, `POST/PATCH /api/v1/colaboradores/*` (autenticadas), `POST /api/v1/admin/colaboradores/*` | Validação com zod no servidor (padrão novo e isolado). |

### 3.5 Página `/@nome` (conteúdo, SEO, estados)
- **Topo:** nome, imagem, descrição, "por Backfindr" discreto, link de volta ao grupo/perfil em destaque (`rel="nofollow noopener noreferrer"`, só `https`, texto do usuário sempre escapado).
- **Botões:** «Perdi», «Encontrei», «Roubaram algo meu» levam a `/flow/lost|found|stolen?colab=<código>` (parâmetro renomeado de `?c=` na E1) (o mesmo fluxo e as mesmas regras de hoje).
- **Feed da página:** consulta nova, mesma elegibilidade do Feed (sem legado) e mesmos campos públicos: primeiro as ocorrências com `colaborador_id` do colaborador (mais recentes primeiro), depois as da região (por **distância real** até o raio configurado, calculada no servidor com coordenadas que nunca saem). Não altera a memória nem a ordem de `/feed`.
- **SEO:** `index, follow` só quando a página está `ativa`, **verificada** (proposta, §7 ponto 8) e tem pelo menos uma ocorrência visível; caso contrário `noindex, follow`. Canonical `https://backfindr.com/@nome`. Entra no sitemap apenas nesse caso. Revalidação de 5 min (como o Feed).
- **Estados:** `ativo` → página; `suspenso` → redireciona 307 ao `/feed`; `saiu` ou `excluido` → redireciona 308 ao `/feed`; `@nome` que nunca existiu → 404 normal.
- **Registro de visitas:** ver §3.8.

### 3.6 Comissão, estorno e saque
**Compra → lançamento** (isolado, depois do ramo atual de ativação do boost no webhook; falha aqui nunca derruba o boost):
1. Gravar o evento em `pagamento_eventos` (único por pagamento e status). Repetição = ignorada.
2. Ler o pagamento na API do MP (como hoje) e usar o **valor pago informado pelo MP** (`transaction_amount`), nunca valor vindo do navegador.
3. Achar o boost e a ocorrência; se `objects.colaborador_id` for nulo, fim.
4. Não gera comissão se: colaborador não está `ativo`; `interno`; boost com `provider='test'`; comprador (`boost.user_id`) **ou** dono da ocorrência é o próprio colaborador; pagamento sem status `approved`; valor fora da tabela de preços esperada (sinal de adulteração) → vai para análise.
5. Percentual vem de `programa_config` **no momento da compra** e é copiado para o lançamento. Arredondamento a definir (§7 ponto 6).
6. Lançamento `comissao` com `disponivel_em` = compra + prazo configurado, e **só conta como "disponível"** se o canal estiver verificado.
**Estorno / cancelamento / contestação:** nova entrada no webhook para os status `refunded`, `cancelled`, `charged_back` (nomes exatos a confirmar na documentação do MP: HIPÓTESE). Gera lançamento `estorno` negativo (idempotente). Se o crédito já foi pago em saque, o saldo pode ficar negativo e o próximo saque desconta. **Não muda o comportamento do boost** (continua ativo, como hoje) até o fundador decidir (§7 ponto 4).
**Saque:** pedido ≥ mínimo configurado e ≤ saldo disponível; cria `saque_reservado`; admin paga manualmente por PIX e marca `pago` (data, comprovante opcional) → `saque_pago`; recusa/cancelamento → `saque_cancelado` devolve o saldo. SLA "até 10 dias úteis" é contado por dias da semana, **sem calendário de feriados** (§7 ponto 11).
**Saída voluntária:** página redireciona; saldo já liberado continua sacável; pendente segue as regras configuradas. **Exclusão por transgressão:** página sai do ar; saldo não pago vira `cancelamento_exclusao` **se** `exclusao_cancela_saldo` estiver ligado (configurável, sujeito a revisão jurídica).
**Troca de canal:** cria nova verificação; enquanto não aprovada, nada novo é liberado.

### 3.7 Admin
Lista (modalidade, canal, @nome, código, estado, verificação, **por mês:** visitas, ocorrências com código, compras, comissão), fila de verificação (aprovar/recusar com responsável, data, motivo), fila de saques (pago, data, comprovante), suspender/excluir (motivo obrigatório), edição das regras de `programa_config`, exportação CSV por colaborador. Toda ação grava em `auditoria`. Nada é apagado: excluir muda `estado`; as ocorrências e o `colaborador_codigo` gravado nelas permanecem.

### 3.8 Segurança, antifraude e LGPD
| Tema | Medida |
|---|---|
| Autoindicação | Comprador ou dono da ocorrência = colaborador ⇒ sem comissão (regra do fundador). |
| Compras simuladas | `provider='test'` nunca comissiona; só `approved` confirmado na API do MP; valor deve bater com a tabela de preços; assinatura do webhook validada (`mp_webhook_secret` já existe e está sem uso). |
| Várias contas | Sinais para **análise manual**, não bloqueio automático: muitas ocorrências com o mesmo código vindas de contas criadas há poucas horas; comprador com e-mail igual ao do colaborador (comparado por hash a partir do pagamento do MP, HIPÓTESE de o MP devolver o dado); muitas compras do mesmo pagador. Lançamento fica `em análise` e não vira disponível sem decisão do admin. |
| Idempotência | `pagamento_eventos` único + `chave_idempotencia` única no livro. |
| Imutabilidade | Gatilhos recusam `UPDATE/DELETE` em `colaborador_lancamentos` e `auditoria`; correção só por lançamento de ajuste com motivo. |
| Conteúdo público do colaborador | Imagem sobe para o R2 com validação de tipo e tamanho (nunca busca URL externa na hora de desenhar o cartaz); textos escapados; link só `https`; moderação = suspender. |
| Chave PIX | Cifrada em repouso (chave de cifragem em variável de ambiente nova: **ação do Marcos**), exibida mascarada, apagável na saída (o lançamento do saque mantém só o final). |
| Visitas à página | A página é estática e guardada em cache, então não "vê" cada visita. Opção: contador agregado por dia e colaborador via chamada leve da página, **sem IP, sem cookie, sem identificador**; conta também robôs (número aproximado) — decidir (§7 ponto 13). Alternativa: ler do PostHog (eventos já existentes, sem dado pessoal). |
| Novos eventos de analytics | Mínimos e sem texto digitado: `colaborador_pagina_vista`, `colaborador_codigo_validado`, `colaborador_codigo_gravado`, todos só com `colaborador_id`. |
| LGPD | Dados novos: nome/canal/imagem (públicos por escolha), chave PIX, aceite. Base legal e texto: **política de privacidade e termos do programa precisam ser revisados antes do lançamento** (texto provisório hoje). Retenção do livro financeiro × direito de exclusão: decisão jurídica (§7 ponto 7). |

---

## 4. Riscos de regressão por fluxo tocado

| Fluxo existente | Como pode quebrar | Como se evita |
|---|---|---|
| **`POST /api/v1/objects`** | Chave nova entra em `category_fields`; validação nova bloqueia cadastro legítimo; 409 perde o código no reenvio; latência extra | Leitura explícita e remoção da chave antes de tudo; código vazio = caminho idêntico ao de hoje (nenhuma consulta nova); validação do código só quando presente; teste de "corpo igual ⇒ linha igual"; cobrir 409, `limit_reached`, documento, `protect`. |
| **Formulário `/dashboard/objects/new`** (e a correção do #158) | Novo campo muda a ordem dos passos ou o envio; `onInvalid` | Campo só no passo final, opcional; **os testes `formulario-ocorrencia` e o comportamento do #158 permanecem** e ganham casos com e sem código; `protect` e «+» sem código idênticos. |
| **`intencaoCadastro` (lista fechada, #157) e `PortaDeEntrada`** | O parâmetro `c` é descartado (some o código) ou atravessa sem validar | Acrescentar `c` à lista fechada com regex própria; teste: qualquer outro parâmetro continua descartado. |
| **`/auth/register`, login, Google** | Redirecionamentos perdem o código | `sessionStorage` só dentro da jornada; teste com e sem Google (E2E no navegador). |
| **Feed `/feed`, API do Feed, contagem do admin** | Alterar `getRankedFeed`/memória/`FEED_SQL` | **Não alterar.** Consulta nova e separada; teste que compara a saída do Feed antes/depois com os mesmos dados. |
| **Cartaz (`poster/route.tsx`)** | Layout quebra; atraso por buscar imagem; vazamento de dado | Faixa de marca em área reservada; imagem do colaborador **já guardada no R2** (sem busca externa nova); sem colaborador ⇒ saída **idêntica byte a byte**; testes de imagem por formato. |
| **Webhook do MP / boost / checkout** | Duplicar boost, derrubar o boost por erro na comissão, mudar resposta ao MP | Camada nova **isolada em try/catch** depois do ramo atual; resposta ao MP inalterada; caixa de entrada própria; **não corrigir** a idempotência do boost no mesmo PR (etapa própria, aprovada à parte). |
| **Middleware** | Reescrita `/@` interfere nos redirecionamentos de login legados e no cookie de origem | Teste de cada ramo do middleware atual; a regra nova só casa `^/@…$`. |
| **Sitemap / robots** | Páginas finas indexadas; vazamento da página "Seja colaborador" | `noindex` até haver conteúdo e verificação; fora do sitemap; sem `Disallow` revelador. |
| **Admin / menu** | Item novo aparece para papéis errados | Mesmo `adminGuard`; teste 401/403. |
| **Rastreamento / privacidade** | Novo cookie ou dado pessoal em evento | Nenhum cookie novo; teste que varre eventos novos por campos proibidos. |
| **Matching, busca, mapa, sitemap de objetos** | Leem colunas novas por engano | Colunas fora de qualquer `SELECT` existente (as rotas públicas de objetos, o Feed, a edição `PUT /objects/[id]` e a criação usam colunas fixas; na busca por `SELECT *`, `o.*` e `RETURNING *` em `src/app/api` o único achado em `objects` foi o do `matching/run`, que não devolve a linha ao público — VERIFICADO, mas a busca foi textual); teste de contrato das saídas públicas (nenhuma chave `colaborador*`). |
| **Migrations** | `ALTER` bloqueia tabela grande; RLS esquecido | Só colunas nulas e tabelas novas, com RLS; aplicar em ordem do Marcos; reversão escrita junto (padrão da 025). |

---

## 5. Plano de testes

| Área | Casos |
|---|---|
| Código preenchido por link | `/@nome` → «Perdi» → cadastro → formulário com código preenchido e nome confirmado; idem com login existente e com Google. |
| Código digitado | `@nome`, `nome`, `ZL27`, minúsculas, espaços; mostra o nome do colaborador; limpar o campo cadastra sem código. |
| Inválido e inativo | Código inexistente, colaborador suspenso, que saiu, excluído, pendente: **mesma resposta**; cadastro não cria com código inválido; mensagem clara. |
| Imutabilidade | `UPDATE` direto via SQL nas duas colunas é recusado pelo gatilho; nenhuma rota de edição as altera; nulo → valor depois do cadastro também é recusado. |
| Corpo desconhecido | Chave extra no corpo **não** vai a `category_fields`; sem código, a linha gravada é igual à de hoje. |
| Autoindicação | Comprador = colaborador; dono da ocorrência = colaborador; ambos sem comissão e com motivo no lançamento. |
| Pagamento | Evento repetido ⇒ um só lançamento; `provider='test'` ⇒ nenhum; valor fora da tabela ⇒ análise; pagamento não aprovado ⇒ nada; falha na camada de comissão ⇒ boost ativado igual. |
| Estorno | Antes e depois do saque; saldo negativo; estorno duplicado; status desconhecido. |
| Saque | Abaixo de R$ 50; acima do saldo; dois pedidos; recusa; pago; chave PIX mascarada. |
| Livro | `UPDATE/DELETE` recusados; soma do livro = saldo exibido. |
| SEO | Ativo+verificado+com conteúdo ⇒ index; sem ocorrência ⇒ noindex; suspenso ⇒ 307; saiu ⇒ 308; canonical; sitemap; `/colaborador/x` ⇒ 308 para `/@x`; «Seja colaborador» fora de menu/sitemap/robots. |
| Feed da página | Primeiro as com código, depois região por raio; sem legado; nenhum campo privado; `/feed` inalterado (mesma saída). |
| Cartaz | Com e sem colaborador nos 3 formatos; sem colaborador = igual ao atual; nome longo e imagem ausente. |
| Responsividade | 375 px e desktop em: `/@nome`, campo do formulário, "Seja colaborador", painel, admin (capturas, como nos PRs anteriores); iPhone/Safari real = HIPÓTESE até o Marcos testar. |
| Regressão geral | Suíte inteira e `tsc` comparados com a linha de base (hoje 72 arquivos / 1.659 testes, 8 erros de tipo antigos); build; testes do #158 e do #157 intactos. |

---

## 6. Etapas, estimativas e dependências
Estimativas minhas, em dias de trabalho de uma sessão de desenvolvimento (não medidas). Cada etapa termina com suíte, `tsc` e build iguais à linha de base, PR em rascunho e nada aplicado em produção sem ordem escrita.

| # | Etapa | Entrega verificável sozinha | Dias | Depende de | Risco principal |
|---|---|---|---|---|---|
| E0 | **Provas técnicas (sem código de produto)** | `/@x` funcionando em `next start` e em prévia da Vercel; tempo do `ALTER` em cópia; formato de estorno/assinatura do MP (documentação + sandbox); decisão da reescrita | 0,5–1 | — | `@` não se comportar na Vercel |
| E1 | **Atribuição (fundação)** | Migration aditiva (`colaboradores`, 2 colunas, gatilho), validador, campo no formulário, `POST /objects` gravando o código; tudo atrás de `COLABORADORES_ATIVO` | 3–4 | E0; ordem do Marcos p/ aplicar a migration | Cadastro de ocorrência |
| E2 | **Página `/@nome` + Feed da página + SEO** | Página pública, botões com código, feed próprio, noindex/redirects, sitemap | 3–4 | E1 | Duplicar conteúdo do Feed; indexação |
| E3 | **Imagem de divulgação com marca** | Cartaz com a marca nos 3 formatos; sem marca = igual | 2–3 | E1 | Cartaz de 680 linhas |
| — | **PILOTO:** `@backfindr` como primeiro colaborador (interno, sem comissão) criado por seed, com ordem do Marcos | Primeiras ocorrências com código real | — | E0–E3 + ligar o interruptor (Marcos) | — |
| E4 | **Pagamentos: caixa de entrada, livro e comissão** (modo sombra: calcula e grava, sem mostrar a ninguém) | Webhook com assinatura e idempotência para o novo caminho; lançamentos; estorno | 5–7 | E1; decisões §7 (2, 4, 6, 7) | **Dinheiro** |
| E5 | **Autoatendimento do colaborador** | "Seja colaborador", dados, @nome com verificação imediata, aceite, verificação do canal, kit de divulgação | 4–5 | E1, E2 | Conteúdo livre na marca |
| E6 | **Painel do colaborador** | Lista, saldo, status, saque, troca de canal, saída | 3 | E4, E5 | Dados pessoais no painel |
| E7 | **Admin** | Lista com métricas por mês, filas, suspensão/exclusão, configuração, exportação | 5–6 | E4, E5 | Permissões |
| E8 | **Antifraude, auditoria completa, visitas, acabamento e QA** | Sinais para análise, contador de visitas, revisão de textos, capturas 375 px/desktop | 3–4 | E4–E7 | — |
| | **Total** | | **≈ 29–37** | | |
| | **Piloto (E0–E3)** | | **≈ 8,5–12** | | |

Etapa paralela e independente (**recomendada antes de E4, aprovação à parte**): endurecer o webhook atual (idempotência do boost, assinatura, não responder 200 em erro, checar dono do objeto no checkout). É correção de falha existente, não do programa, e é o ponto de maior regressão; por isso não entra misturada.

---

## 7. Contradições com o código atual e decisões do fundador

| # | Ponto | Situação | Decisão necessária |
|---|---|---|---|
| 1 | «Nada de dado novo no banco para o Feed e o `/achei`» (Regras que não mudam) | O programa grava dado novo em `objects` e cria tabelas | Marcos refinar a regra por escrito (escopo: só a fase anterior do Feed/`/achei`). **Antes de qualquer código.** |
| 2 | Estorno hoje ignorado; webhook sem assinatura nem idempotência; checkout sem checar dono | Contradiz "idempotente", "estorno desconta" e "só servidor" | Aprovar a etapa de endurecimento e a ordem (antes de E4) |
| 3 | Regra "nenhum texto público sugere parcerias inexistentes" | **Não a encontrei** em `DECISOES.md`, `BACKFINDR.md`, `STATUS.md` nem em `docs/` (só o aviso de `check-public-claims` sobre "parceiro"). O desenho a respeita (página "Seja colaborador" só por link, noindex, sem menu), mas a fonte precisa ser registrada | Marcos indicar onde está a regra ou registrá-la |
| 4 | Estorno: o boost continua ativo? | Hoje continua. O programa só desconta a comissão | Decidir se o boost é desativado no estorno (muda comportamento atual) |
| 5 | Saque mínimo R$ 50 × volume | ≈ 9 compras de R$ 24,90 por saque; 2 compras em toda a vida do produto | Manter R$ 50 no lançamento? (configurável de qualquer forma) |
| 6 | Base e arredondamento da comissão | 25 % do valor pago (bruto); taxa do MP **não verificada**; 25 % de R$ 9,90 = R$ 2,475 | Bruto ou líquido da taxa; arredondar para baixo, cima ou "meio para cima" |
| 7 | Guarda do livro financeiro × exclusão de conta (LGPD) e cancelamento do saldo na exclusão | Sujeito a revisão jurídica (Marcos já sinalizou) | Prazo de guarda e texto; **jurídico** |
| 8 | Indexar página ativa **ainda não verificada**? | Regra do fundador: "ativa e com conteúdo". A página entra no ar antes da verificação, então qualquer pessoa poderia indexar um nome de grupo alheio | Proposta: `noindex` até verificação (aprovar ou recusar) |
| 9 | Legado (Q-26 somente leitura) e colaborador | Legado sem conta atualizada não cadastra, logo não gera ocorrência com código; pode ser colaborador? | Permitir só após atualizar a conta? |
| 10 | Prazo de liberação da comissão (janela de contestação) | Não verificei a janela de contestação do MP | Definir dias (configurável) |
| 11 | "10 dias úteis" | Sem calendário de feriados no sistema | Contar só dias de semana (proposta) ou incluir feriados |
| 12 | Código na URL e rastreadores | O código é público, não credencial; viajará em `?colab=` (antes `?c=`) para GA4/Meta/PostHog como qualquer parâmetro | Aceitar assim, ou removê-lo da URL antes de rastrear (mais trabalho) |
| 13 | Visitas por mês | Contador próprio (aproximado, sem pessoa) ou ler do PostHog | Escolher |
| 14 | Chave PIX e dados do recebedor | Cifrar exige variável nova; recolher CPF/CNPJ do recebedor é questão fiscal | Definir o que coletar; **jurídico/contador** |

Pontos de menor peso que seguem o padrão do desenho (confirmar na aprovação): `@nome` e código curto **não mudam depois** (só o admin, com redirecionamento); um colaborador por conta no lançamento; `@backfindr` marcado como interno; kit de divulgação sem promessa de contato protegido, de resposta ou de resultado (regras vigentes do Feed); e-mails do programa só de serviço.

---

## 8. Conclusão em linguagem simples

**Dá para fazer, sem mexer no que funciona.** A ideia central, o código fica gravado na ocorrência no dia em que ela é criada e nunca mais muda, encaixa bem no sistema de hoje. Depende de duas colunas novas em `objects` e de tabelas novas; o Feed, a busca, o mapa e o matching não precisam ser tocados.

**O ponto que exige mais cuidado é o dinheiro.** Hoje o sistema de pagamento não está preparado para pagar comissão com segurança: se o Mercado Pago avisar a mesma compra duas vezes, ele cria dois boosts; não confere a assinatura do aviso; e não faz nada quando uma compra é estornada. Por isso, o desenho coloca um livro-caixa novo (só entra lançamento, nunca se edita) e uma caixa de entrada de avisos, sem mexer no que ativa o boost. E recomenda consertar o webhook atual numa etapa separada, antes de comissionar qualquer coisa.

**O piloto é barato e não envolve dinheiro.** Em ≈ 8 a 12 dias fica pronto o registro do código, a página `/@backfindr`, o feed da página e o cartaz com marca. Assim dá para testar se divulgar por página própria traz gente antes de construir saque, painel e admin (mais ≈ 20 a 25 dias).

**Três alertas honestos.** (1) Com 2 compras de "ampliar alcance" na história do produto, o saque mínimo de R$ 50 pode levar meses para ser atingido por qualquer colaborador. (2) A política de privacidade ainda diz que não há rastreamento; o programa acrescenta dados novos, então o texto precisa ser atualizado antes do lançamento. (3) Não testei: o endereço `/@nome` na Vercel, o comportamento exato de estorno do Mercado Pago, nem nada no iPhone; a etapa E0 resolve os dois primeiros antes de qualquer código.

**Antes de começar:** o Marcos precisa decidir ao menos os pontos 1, 2, 3, 7 e 8 da seção 7.

---

## 9. Estado real das etapas (atualizado a cada etapa)

**Aprovação do fundador (23/11/2026):** executar SOMENTE o piloto (E0 a E3); E4 a E8 suspensas até o piloto mostrar resultado (PC-02). Uma etapa por PR, em rascunho, sem mesclar sem aprovação. Interruptor `COLABORADORES_ATIVO` desligado por padrão. Primeiro e único colaborador do piloto: o próprio Backfindr (`/@backfindr`), criado só pelo admin; o autoatendimento fica para depois.

**Refinamentos registrados (DECISOES.md):** PC-03 (o Feed e o `/achei` não ganham dados novos próprios; o programa cria colunas e tabelas isoladas, sem alterar o comportamento deles; página não verificada = `noindex` e fora do sitemap), PC-04 (regra de comunicação de 04/10/2026: nenhum texto público sugere parcerias inexistentes), PC-05 (imutabilidade desde o piloto), PC-06 (LGPD do livro financeiro: parecer jurídico pendente, não bloqueia o piloto).

**Confirmação pedida pelo fundador (ponto 2): o código fica gravado de forma imutável em cada ocorrência desde o piloto, e a comissão de compras do período poderá ser calculada depois.** Está garantido por construção, sem gravar nada financeiro agora:
1. `objects.colaborador_id` e `objects.colaborador_codigo` são gravados **no mesmo `INSERT`** da ocorrência (E1);
2. um gatilho no banco recusa qualquer `UPDATE` dessas colunas depois do cadastro (inclusive de nulo para valor), então nem uma rota nova nem um erro de código consegue trocar ou acrescentar o código depois;
3. a compra de «ampliar alcance» já liga ao objeto (`boosts.object_id`, verificado), e o objeto carrega o código; logo, para qualquer compra feita no piloto, a consulta «boost → objeto → colaborador» devolve o colaborador, o valor (`boosts.amount_paid`, hoje a única fonte do valor; a E4 vai preferir o valor confirmado pelo Mercado Pago) e a data;
4. o colaborador pode sair, ser suspenso ou excluído: a linha nunca é apagada (`ON DELETE RESTRICT`) e o texto do código fica na ocorrência.
Limite honesto: o retroativo só é confiável para boosts que existirem nas tabelas atuais; estornos feitos **antes** da E4 não ficam registrados (o webhook de hoje os ignora), então a E4 terá de conferir os pagamentos do período no Mercado Pago antes de comissionar. Isso é uma tarefa da E4, hoje suspensa.

| Etapa | Estado | PR | Verificação |
|---|---|---|---|
| E0 — prova da rota `/@nome` | **VERIFICADA E APROVADA pelo fundador (23/11/2026).** NÃO mesclada: as etapas do piloto serão mescladas juntas, depois de aprovadas | #163 (empilhado sobre o #162) | local + prévia da Vercel (abaixo) |
| E1 — atribuição | **APROVADA pelo fundador (23/11/2026) com base na verificação local; NÃO mesclada** (as etapas do piloto serão mescladas juntas). A verificação na Vercel passou para o fim do piloto. **Migration 026 NÃO aplicada em produção** (precisa de ordem escrita) | ver STATUS.md | `e1/NAO-REGRESSAO.md` |
| E2 — página `/@nome` + feed + SEO | **APROVADA pelo fundador (23/11/2026) com base na verificação local; NÃO mesclada** (as etapas do piloto serão mescladas juntas). Sem verificação na Vercel (será feita uma vez, no fim do piloto) | ver STATUS.md | `e2/NAO-REGRESSAO.md` |
| E3 — cartaz com a marca | **CÓDIGO PRONTO e verificado localmente** (PR em rascunho, empilhado sobre a E2); aguarda aprovação do fundador. Sem verificação na Vercel (feita uma vez, no fim do piloto) | ver STATUS.md | `e3/NAO-REGRESSAO.md` |
| E4 a E8 | SUSPENSAS (decisão do fundador, 23/11/2026) | — | — |

### E0 — o que foi construído
- `src/lib/colaboradores/rota.ts`: interruptor `COLABORADORES_ATIVO` (só liga com exatamente `1`), formato do `@nome` (3 a 30, `a-z0-9-`, sem hífen nas pontas) e decisão de rota (funções puras, usadas pelo middleware).
- `src/middleware.ts`: com o interruptor ligado, `/@nome` é reescrito para `/colaborador/nome` (a URL do navegador não muda) e `/@Nome` redireciona 308 para a forma minúscula; **desligado, o bloco não faz nada** e o resto do middleware (cookie de origem, redirecionamento de links antigos com token) segue idêntico.
- `src/app/colaborador/[slug]/page.tsx`: página **de prova** (sem banco, sem dados, `noindex`); com o interruptor desligado responde 404, como hoje. A página real é a E2.
- `src/app/colaborador/layout.tsx` e `src/lib/clarity.ts`: a guarda do Clarity (`tests/clarity.test.ts`) exige decisão para toda pasta nova; `/colaborador` entrou como **pública e mascarada** (mesmo tratamento do Feed), sem gravação de texto na sessão.
- `tests/colaboradores-rota.test.ts` (10 testes): formato, caminhos que não casam, interruptor, middleware ligado/desligado, caminhos não relacionados idênticos nos dois estados, cookie de origem e redirecionamento de token preservados.

**Verificação de não regressão da E0:** `docs/programa-colaboradores/e0/NAO-REGRESSAO.md` (linha de base, comparação main × desligada × ligada, prints 375 px e desktop). Resultado: nenhuma diferença não planejada.

### E0 — o que ficou provado (build local `next build` + `next start`)
| Caso | Desligado | Ligado |
|---|---|---|
| `/@backfindr` | 404 (como hoje) | 200, página de prova, `noindex` |
| `/@BackFindr` | 404 | 308 → `/@backfindr` |
| `/@backfindr?c=ZL27` | 404 | 200 (a query chega) |
| `/@ab`, `/@abc/def` | 404 | 404 |
| `/colaborador/backfindr` (acesso direto) | 404 | 200 (a E2 passará a redirecionar para `/@backfindr`) |
| `/feed`, `/robots.txt` | 200 | 200 |
Achados da prova:
1. **Cache de 404.** A página é estática com revalidação de 300 s (como o Feed). Uma resposta 404 gerada com o interruptor desligado (ou antes de o colaborador existir) fica guardada e pode ser servida por até 5 minutos depois de a página passar a existir. Mitigação prevista: na E2, criar/ativar o colaborador chama `revalidatePath` da própria página. Ao ligar o interruptor em produção, esperar até 5 minutos para que 404s antigos expirem.
2. `/@nome/` (com barra) redireciona 308 para `/@nome`; é a normalização do próprio Next e já é assim com o interruptor desligado.
3. **Prova na Vercel: FEITA pelo fundador em 23/11/2026** (a sessão não consegue abrir a prévia, protegida por login da Vercel). Prévia da branch `claude/backfindr-colaboradores-e0`, com `COLABORADORES_ATIVO=1` restrita só a essa branch (Production nunca recebeu a variável; a variável foi apagada depois e nenhum deploy novo foi feito). Resultados informados pelo fundador: `/@backfindr` 200, página de prova, `robots` «noindex, nofollow»; `/@BackFindr` redireciona para `/@backfindr`, noindex; `/@ab` 404; `/feed`, `/` e `/achei` 200 com «index, follow» e títulos normais; `/perdi` respondeu 307. **Esse 307 já existe hoje e não foi introduzido pela E0** (conferido em 23/11/2026): `https://backfindr.com/perdi` em produção responde `HTTP/2 307` com `x-vercel-cache: HIT` e `age` ≈ 263.000 s (cerca de 3 dias, anterior à E0); `src/app/perdi/page.tsx` chama `redirect('/flow/lost')` e não foi alterado (último commit do arquivo: #89; a E0 não toca em `src/app/perdi`); o build local da `main` também deu 307 → `/flow/lost`, igual à E0 desligada e ligada.
4. Os itens de «medir o tempo do `ALTER`» e «formato de estorno do Mercado Pago» da E0 original **saem da E0**: o primeiro vira medida da E1 (cópia local); o segundo pertence à E4 (suspensa).

### E1 — o que foi construído (detalhe em `e1/NAO-REGRESSAO.md`)
- `src/db/migrations/026_colaboradores.sql` (**não aplicada**): tabela `colaboradores`, colunas nulas `objects.colaborador_id` e `objects.colaborador_codigo`, gatilho de imutabilidade, reversão testada.
- `src/lib/colaboradores/codigo.ts` (resolução do código, só servidor), `limite.ts` (30 pedidos/min por origem, em memória), `cliente.ts` (navegador: `?colab=`, `sessionStorage`).
- `GET /api/v1/colaboradores/validar` (404 desligado; só `{ok, nome}`; inexistente = inativo = mesma resposta).
- `POST /api/v1/objects`: lê o código de forma explícita (a chave sai de `category_fields`), valida no servidor, grava no mesmo `INSERT`; sem código executa o comando original.
- Formulário: campo opcional e discreto no último passo, só com o programa ligado; `layout.tsx`: captura do `?colab=` na aba.
- **Parâmetro da URL: `?colab=`** (o rascunho do desenho dizia `?c=`; mudou para evitar colisão com parâmetros existentes). Interruptores: `COLABORADORES_ATIVO=1` (servidor) e `NEXT_PUBLIC_COLABORADORES_ATIVO=1` (navegador, fixado no build); ligar juntos.
- **Para ligar na prévia/produção (depende do Marcos):** aplicar a 026 no banco usado, criar o colaborador `@backfindr` (E2), definir as duas variáveis. Nada disso foi feito.

### E2 — o que foi construído (detalhe em `e2/NAO-REGRESSAO.md`)
- `src/app/colaborador/[slug]/page.tsx`: página real em `/@nome` (topo com nome, imagem ou inicial, descrição, «por Backfindr» discreto e link de volta ao grupo/perfil em destaque, `https` e `nofollow`; botões «Perdi algo / Encontrei algo / Roubaram algo meu» para os fluxos de sempre com `?colab=<código curto>`; feed da página). Estática com revalidação de 5 min; 404 desligada, antes de qualquer consulta ao banco.
- Estados: ativo = página; suspenso = 307 e saiu/excluído = 308 para o Feed; inexistente = 404.
- SEO (PC-03): `index` só com página ativa + verificada + ao menos uma ocorrência cadastrada com o código; senão `noindex`; canônica `/@nome`; sitemap só com esse mesmo critério (vazio desligado). Nenhum link do site geral, menu ou `robots.ts` aponta para as páginas de colaborador (teste de guarda, PC-04).
- `src/lib/colaboradores/feed.ts`: consulta própria (mesma elegibilidade e mesmos campos públicos do Feed; primeiro as com o código, depois as da região por distância dentro do raio; até 24). O Feed geral não foi alterado (teste de paridade: o cartão é igual ao do Feed para a mesma ocorrência).
- Admin: aviso visível quando `COLABORADORES_ATIVO` e `NEXT_PUBLIC_COLABORADORES_ATIVO` estão diferentes (rota `GET /api/v1/admin/colaboradores/interruptores`, só admin; nada renderizado quando iguais).
- `docs/programa-colaboradores/seed-backfindr.sql`: seed do `@backfindr` (**não executado**; só para o banco isolado, com ordem do fundador).

## 10. Verificação na Vercel, uma vez, ao final do piloto: banco isolado (levantamento de 23/11/2026; NADA foi executado)

Decisão do fundador (23/11/2026): a verificação na Vercel será feita **uma vez**, depois da E3, com todas as etapas juntas, **num banco isolado**; a migration 026 **não** é aplicada em nenhum banco compartilhado com a produção.

### 10.a As prévias da Vercel usam o mesmo banco da produção?
**Não consigo ver as variáveis da Vercel; o que segue é evidência, não confirmação.**
| Evidência | O que indica |
|---|---|
| `BACKFINDR.md` (auditoria de 25/08/2026): «Produção e Preview batem entre si (nenhuma variável só em um dos dois)» | `DATABASE_URL` existe nos dois escopos |
| `BACKFINDR.md`: os testes foram feitos «via preview do Vercel, nunca localhost real» | as prévias acessam um banco real |
| `docs/ROTACAO-SEGREDOS.md`: «Production e Preview têm valores independentes» (sobre os segredos rotacionados) | não diz nada sobre `DATABASE_URL` |
| Supabase (consulta de 23/11/2026): a organização tem 3 projetos (um deles pausado) e **nenhuma branch de banco**; não existe banco de teste ou staging do Backfindr | se a prévia tem `DATABASE_URL`, ela só pode apontar para o projeto de produção do Backfindr (ou para um dos outros projetos, improvável) |
**Conclusão (inferência):** é provável que as prévias usem o **mesmo banco da produção**. Regra até confirmar: **nenhum teste que escreva dados (cadastro, boost, conta) em prévia**. As verificações de E0 já feitas na prévia foram só de leitura de páginas.
**Como o fundador confirma em 1 minuto, sem expor valores:** Vercel → projeto → Settings → Environment Variables → procurar `DATABASE_URL`. Se há **uma** linha marcada com Production e Preview, o valor é o mesmo. Se há duas linhas (uma Production, outra Preview), abrir «Edit» e comparar só o **nome do host** (`db.<identificador do projeto>.supabase.co`) sem copiar nem colar o valor.

### 10.b Opção recomendada para o banco isolado
Fatos verificados em 23/11/2026 (Supabase, MCP e documentação): a organização está no plano **Free**; o plano Free permite **2 projetos ativos** e projetos pausados não contam; hoje há 2 ativos (o do Backfindr e outro, «Resolve Tudo») e 1 pausado; o banco do Backfindr tem **50 MB, 56 tabelas** e a extensão `pg_trgm`; **não há histórico de migrations** no banco (a lista veio vazia) e a pasta `supabase/` do repositório só tem funções, sem migrations.
| Opção | Custo estimado | Observações |
|---|---|---|
| **1. Novo projeto Supabase só para o teste (recomendada)**, copiando só o **esquema** | Free: US$ 0, **se** houver vaga: hoje não há (2 ativos); precisaria pausar temporariamente o projeto «Resolve Tudo» (decisão do fundador; eu não sei se ele está em uso). Pago: Pro a partir de US$ 25/mês e cerca de US$ 10/mês por projeto extra em computação Micro (o crédito de US$ 10 cobre um projeto); apagar o projeto depois do teste (se a cobrança é proporcional aos dias não foi verificado: conferir no painel antes de criar). | Mesmo motor e extensões da produção; sem dados pessoais (só esquema). |
| 2. Branch de banco do Supabase | Exige plano pago (HIPÓTESE: não confirmado nas páginas lidas). US$ 0,01344 por hora de uma branch Micro (≈ US$ 0,32 por dia; ≈ US$ 9,8 por mês se ficar ligada), fora do teto de gasto, **mais** o plano Pro. | Como o banco não tem histórico de migrations, a branch nasceria **sem as tabelas** (HIPÓTESE: pelo que a documentação diz de como as branches são criadas, não confirmado aqui); o esquema precisaria ser carregado do mesmo jeito. Mais peças e mais custo que a opção 1. |
| 3. Postgres gratuito de outro provedor | Preço e limites **não verificados** aqui. | Avaliar só se o fundador quiser evitar mexer no plano do Supabase; mesmo passo de carregar o esquema. |
**Recomendação:** opção 1. Se o fundador preferir custo zero e o projeto «Resolve Tudo» puder ficar pausado por alguns dias, é a melhor; senão, plano Pro por um mês (≈ US$ 35 com 3 projetos ativos, conforme a conta da documentação) e apagar o projeto de teste depois.
**Passos (nenhum executado):**
1. Criar o projeto de teste, mesma região da produção, com senha forte própria (o fundador).
2. **Copiar só o esquema:** o fundador roda `pg_dump --schema-only --no-owner --no-privileges` contra a produção (leitura) e restaura no projeto de teste. **Sem dados:** nenhum dado pessoal sai da produção.
3. No banco de teste: `payments_enabled = false` em `payment_settings` (o boost entra em modo de teste, sem cobrança), usuários de teste e o necessário para o Feed (a tabela `municipalities` pode ficar vazia).
4. Aplicar a 026 e o seed do `@backfindr` (10.c).
5. **Apontar SÓ a prévia da branch do piloto para ele:** na Vercel, criar `DATABASE_URL`, `COLABORADORES_ATIVO=1` e `NEXT_PUBLIC_COLABORADORES_ATIVO=1` no ambiente **Preview** com o filtro **Git Branch = a branch do piloto (`claude/backfindr-colaboradores-e3`)**. A Vercel permite variáveis de Preview por branch, e a específica de uma branch prevalece sobre a de «todas as branches» (documentação da Vercel, **não conferida aqui**). Nada em Production nem nas demais prévias.
6. **Prova de isolamento antes de qualquer cadastro:** gravar uma linha-marca no banco de teste (por exemplo, uma ocorrência com título «TESTE-ISOLADO») e confirmar que ela aparece na prévia da branch do piloto e **não** aparece em `backfindr.com` nem na prévia de outra branch.
7. Cuidados na prévia de teste: e-mails de verdade podem sair no cadastro (usar endereços descartáveis); o token do Mercado Pago do ambiente Preview pode ser real (não tocar em pagamento: `payments_enabled = false` no banco de teste).
8. Ao final: apagar as 3 variáveis e o projeto de teste; confirmar que a produção não mudou.

### 10.c Aplicar e reverter a 026 no banco isolado
- **Aplicar:** colar `src/db/migrations/026_colaboradores.sql` no SQL Editor do projeto de teste (é idempotente e aditiva); depois `docs/programa-colaboradores/seed-backfindr.sql`; depois as consultas de verificação que estão no fim de cada arquivo (somente leitura).
- **Reverter a 026:** o bloco «Reversão» no fim do próprio arquivo (gatilho, função, índice, as duas colunas de `objects`, tabela `colaboradores`); testado em `tests/colaboradores-atribuicao.test.ts` (a reversão roda, o `objects` volta ao que era e reaplicar funciona). Perde-se só a atribuição gravada **no banco de teste**.
- **Reverter só o seed:** `update colaboradores set estado = 'saiu' where slug = 'backfindr'` (a linha nunca é apagada); a página passa a redirecionar para o Feed.
- **Desfazer tudo:** apagar o projeto de teste.

### E3 — o que foi construído (detalhe em `e3/NAO-REGRESSAO.md`)
- `src/lib/colaboradores/marca.ts`: marca do cartaz (nome até 34 caracteres e logo opcional, https, 96×96). **Devolve `null` sem consultar o banco com o programa desligado**; consulta própria e à prova de falha (migration ausente ou erro de banco = sem marca); só colaborador **ativo**.
- `src/components/colaboradores/MarcaDoCartaz.tsx` e **9 linhas acrescentadas** em `src/app/api/v1/objects/[id]/poster/route.tsx` (0 removidas): a linha «Divulgado por <nome>» nos três modelos (quadrado, vertical e A4), versão pública e baixada.
- **Garantia de não regressão:** cartaz de ocorrência **sem código** idêntico byte a byte ao atual (36 de 36, desligado e ligado); com código e programa desligado, também idêntico (24 de 24); com colaborador suspenso, sem marca (6 de 6); só colaborador ativo muda o cartaz (18 de 18).

### 10.a Confirmado pelo fundador (23/11/2026)
No painel da Vercel existe **uma única `DATABASE_URL`, com escopo «All Environments»**. Portanto **todas as prévias usam o MESMO banco da produção** (a inferência anterior virou fato). **Regra mantida: nenhum teste que escreva dados (cadastro, boost, conta, imagem) em prévia apontada para esse banco.** Isso inclui as prévias das branches E0 a E3 enquanto a variável da branch do piloto (§10.b) não existir.

### 10.b Decidido pelo fundador (23/11/2026): banco isolado = projeto Supabase «Resolve Tudo»
Regras: o **Storage do «Resolve Tudo» e seus documentos não podem ser tocados de forma alguma**; antes de qualquer ação, **somente leitura** do catálogo; se houver tabelas ou dados, parar e reportar. **Situação em 23/11/2026:** a leitura **não foi possível** (a autenticação do conector no banco do «Resolve Tudo» falhou nas quatro tentativas; o projeto também aparecia como hibernado). **Nada foi confirmado sobre o conteúdo dele e nada foi escrito lá.** O fundador roda `catalogo-resolve-tudo.sql` no painel e cola o resultado (ver `docs/programa-colaboradores/verificacao-final/ROTEIRO.md` §1.1).
**Método (substitui a opção 1 da tabela acima):** em vez de usar `public` do «Resolve Tudo», usar um **schema próprio** (`backfindr_teste`) e um **papel próprio** (`backfindr_teste_app`, com `search_path` fixo e sem acesso a `storage`/`auth`): nada em `public`, limpeza com um único `DROP SCHEMA ... CASCADE`, e o app não precisa de nenhuma mudança de código. Ensaio local do método: o esquema gerado por catálogo, aplicado num schema dedicado, ficou com assinatura idêntica à da origem (colunas, índices, restrições, gatilhos, funções) e nada foi criado fora do schema.
**Roteiro completo, com quem faz cada passo, as variáveis da prévia (só para a branch do piloto), a prova de isolamento, os testes, a reversão e a limpeza:** `docs/programa-colaboradores/verificacao-final/ROTEIRO.md` (+ arquivos SQL na mesma pasta). **Nada foi executado.**

### 10.d Atualização de 23/11/2026 (depois da E3 aprovada)
- **Piloto E0 a E3 completo e aprovado** (não mesclado).
- **Catálogo do «Resolve Tudo» conferido pelo fundador** no painel (somente leitura): sem objetos em `public`, sem tabelas fora dos schemas internos, sem funções/políticas/gatilhos fora deles, sem papéis não padrão, sem colisão; `pg_trgm` não existe (o teste a cria e a limpeza a remove). Linha de base da assinatura registrada em `docs/programa-colaboradores/verificacao-final/LINHA-DE-BASE-ANTES.md`.
- **Defeito corrigido** no `catalogo-resolve-tudo.sql` (`c.relkind::text`); conferido que nenhum outro SQL da pasta tem o problema.
- **Ensaio local de ponta a ponta dos SQL da pasta** (banco local imitando o «Resolve Tudo»): preparar → `set role` → aplicar o esquema como o papel → assinatura do esquema idêntica à origem → 026 e seed → conexão como o papel (`search_path` certo, escrita e RLS funcionando para o dono, **nada criado em `public`**) → limpeza → assinatura do catálogo **igual à de antes**.
- **Roteiro final em linguagem simples, passo a passo, com quem executa e quando o fundador precisa estar presente:** `docs/programa-colaboradores/verificacao-final/ROTEIRO-SIMPLES.md`. **Nada foi executado**; cada fase só começa com a ordem escrita do fundador.

### 10.e Atualização de 24/11/2026: verificação isolada CANCELADA; lançamento controlado
A verificação isolada no «Resolve Tudo» (§10.b a §10.d) foi **cancelada pelo fundador** (PC-10); **nada foi executado lá**; os arquivos de `verificacao-final/` ficam como registro, marcados como **superados**. **Caminho atual:** lançamento controlado do piloto (E0 a E3) na produção, em passos autorizados um de cada vez (0 a 3; o 4, ligar o piloto, não está autorizado): `docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md`. **Estado (atualizado em 24/11/2026):** passo 0 feito (plano, script de comparação somente leitura, retratos «antes» da produção); **passo 1 confirmado**: não é preciso dump manual, pois existe **backup próprio diário** do banco do Backfindr (repositório `m2r-backup-supabase`; o Supabase não tem backup nativo no plano Free, mas o backup próprio funciona); a run #36 (00:12 BRT, sucesso) gerou um arquivo de 5.890.594 bytes com **56 tabelas com dados**, conferido por leitura do registro; **passo 2 CONCLUÍDO em 24/11/2026**: migration 026 aplicada na produção exatamente como testada e verificada (colunas novas nulas e vazias, tabela `colaboradores` criada, gatilhos presentes, contagens 57/689/205/203/6/36, assinaturas antigas intactas, dados existentes iguais) e a comparação «antes × depois» da produção deu tudo igual; o passo 3 (mescla) ainda não foi iniciado. A regra de não regressão e a regra «divergência = parar e reportar» valem em todos os passos.

### 10.f Atualização de 24/11/2026: Passo 3 concluído
**Passo 3 CONCLUÍDO (24/11/2026): #162 a #166 mesclados na `main` em ordem, um de cada vez, com interruptores DESLIGADOS (não existem na Vercel); produção sem mudança de comportamento; PARADO aqui, Passo 4 NÃO iniciado.** Commits de mescla: #162 `9c7928ac`, #163 `10ca3b2e`, #164 `40d309de`, #165 `936850c8`, #166 `a2a4ca4f` (`main` em `a2a4ca4`). Impressão de produção: `ce5fc691abb0904d` → `004efedc3c60b3b2` → `6fc480ae26040ada` → `5836d4974d10097c` → `cadd3a3456f870ae` → `ae027c42f88d3438`. Comparação final «antes × depois» (`lancamento/depois-passo3.json`): 13 rotas iguais, exceto (a) `/feed` (variação natural, similaridade 1,000) e (b) o CORPO da 404 de duas rotas internas novas e não linkadas, aceitas por ordem do fundador (`/colaborador/backfindr`: 404 com corpo quase vazio em vez da tela padrão; `/api/v1/colaboradores/validar`: 404 com corpo vazio; status continua 404); `/@backfindr` e `/@BackFindr` = 404 iguais ao «antes»; `sitemap.xml` e `robots.txt` iguais (nenhuma menção a colaborador); 4 cartazes públicos reais **idênticos byte a byte**; `POST /api/v1/objects` sem login = 401. Trechos inativos do programa aparecem no código do navegador (`bf_colab`, `/api/v1/colaboradores`, `colaborador_codigo`): anotados, não são comportamento (critério substituído, PC-12). Verificação de comportamento em navegador automatizado (perdido, achado e roubado com `?colab=teste123`, até o último passo, SEM enviar, 375 px e 1280 px): campo «Código do colaborador» ausente, nenhuma chave «colab» guardada, nenhuma requisição a `/api/v1/colaboradores`, nenhuma ocorrência criada; e, pelo Claude do navegador na produção, `/flow/lost` e `/flow/found` com `?colab=` sem nada guardado. Reversão disponível: Instant Rollback para `backfindr-3dtxeok5q` (não usado). **Aguarda a ordem escrita do fundador para o Passo 4.**

### 10.g Decisões de 24/11/2026 (PC-13) e pendências do @nome
**Passo 4: roteiro final PRONTO (24/11/2026), NÃO executado; aguarda ordem escrita do fundador (e a presença dele).** Teste com a `/@backfindr` SEM verificação (noindex, fora do sitemap); `MATCHING_ATIVO` desligado durante o teste (valor atual anotado antes, religado depois); interruptores só em Production; ocorrências de teste arquivadas, não apagadas. Por leitura do código: ocorrência arquivada NÃO conta para a regra de indexação. Roteiro em `docs/programa-colaboradores/LANCAMENTO-CONTROLADO.md` (Passo 4). Decisões novas em PC-13. **Pendências para depois do piloto (levantadas por LEITURA do código e do banco em 24/11/2026; NADA implementado):** (1) **Hoje o @nome nunca é reaproveitado, por construção:** índice único `uq_colaboradores_slug` em `lower(slug)` sobre TODAS as linhas, e o gatilho recusa `DELETE`; o `codigo_curto` também é único para sempre. A regra dos 12 meses exige um jeito de LIBERAR o @nome da linha antiga (sem apagá-la e mantendo o `id`, o vínculo das ocorrências e o código curto antigo), por exemplo índice único parcial só sobre linhas que não liberaram o @nome; **não existe hoje nenhum campo de «última atividade»** (poderia derivar de `objects.created_at` das ocorrências com `colaborador_id`; a definição de «atividade» é decisão do fundador). (2) **Estados hoje:** `ativo` (página), `suspenso` (307 para o Feed), `saiu` e `excluido` (308 permanente para o Feed). **Atenção:** o 308 é guardado pelos navegadores; se o colaborador que saiu reativar, quem já visitou pode continuar sendo mandado ao Feed. **Aceito pelo fundador em 24/11/2026 (PC-13): 307 para `saiu` (permite reativação) e 308 só para `excluido`; ainda NÃO implementado (hoje 308 para os dois); o teste do Passo 4 não depende disso.** (3) **Reativação não existe no código:** nenhum `UPDATE colaboradores` em `src/`; mudanças de estado só por SQL manual. Falta: o próprio colaborador reativar (`saiu` por vontade própria ou `suspenso`) e a trava de que `excluido` **nunca** volta (por exemplo um gatilho que recuse `excluido` → `ativo`). No piloto só existe o `@backfindr` (interno, sem conta própria). (4) **Vínculo das ocorrências antigas:** `objects.colaborador_id` (imutável por gatilho) aponta sempre para o colaborador anterior (correto), mas `objects.colaborador_codigo` guarda o TEXTO usado (`@nome` ou código curto) e esse texto passaria a designar outra pessoa; relatórios e repasses devem usar SEMPRE `colaborador_id`, nunca o texto. (5) **Código no resolvedor:** `resolverColaborador` já exige `estado = 'ativo'`, mas `carregarColaborador` busca por `lower(slug)` com `LIMIT 1` sem ordem; com duas linhas de mesmo @nome (a antiga liberada e a nova) a busca precisaria ignorar a linha liberada. (6) O código curto novo para a outra pessoa sai naturalmente de uma LINHA NOVA (id e código novos); o código é sorteado no SQL do Passo 4.1 (não há gerador no código da aplicação). (7) **Refina o desenho:** `DESENHO.md` (tabela `colaboradores`), a migration 026 e o `seed-backfindr.sql` dizem «o @nome nunca é reutilizado»; a decisão de 24/11/2026 passa a «reaproveitável só depois de 12 meses sem atividade do anterior». Os comentários desses arquivos ficam como estão até a implementação.

### E5 — o que foi construído (24/11/2026, rascunho; detalhe no relatório do PR)
Inscrição só por link (`/colaborador/seja`, `noindex`), política oficial em `/colaborador/politica`, aceite, @nome, imagem própria (R2), verificação do canal (`BF-XXXX-XXXX`, fila por API de admin), painel mínimo com «comissão em apuração», kit de divulgação, troca de canal, saída e reativação; interruptor `COLABORADORES_INSCRICAO`; migration 027 (não aplicada). **Correção ao §3.5:** `saiu` = 307 (volta possível, PC-13); só `excluido` = 308. **E5b (pendente):** liberar o @nome após 12 meses sem atividade.

### E4 — o que foi construído (24/11/2026, rascunho; detalhe no relatório do PR)
Modo sombra: `src/lib/colaboradores/comissao.ts` (cálculo, elegibilidade, lançamento, estorno, saldo), camada isolada no webhook (`COMISSAO_SOMBRA`), rota de conferência do admin, migration 028 (`programa_config`, `pagamento_eventos`, `colaborador_lancamentos` só-INSERT, índice único em `boosts`). Decisões aplicadas: N1 só Boost, bruto para baixo, 14 dias, estorno desconta e o Boost não muda. **Não há tela de valores até a E6.**

### E6 — o que foi construído (24/11/2026, rascunho; empilhado sobre a E4)
Painel com ocorrências do link, saldo (atrás de `COLABORADORES_SALDO`), dados de pagamento cifrados (`PIX_CHAVE_CIFRAGEM`) e pedido/cancelamento de saque (atrás de `COLABORADORES_SAQUE`); migration 029 (`colaborador_dados_pagamento`, `colaborador_saques`). A fila de pagamento do admin é a E7.

### E7 — o que foi construído (24/11/2026, rascunho; empilhado sobre a E6)
Tela `/admin/colaboradores` (lista com métricas do mês, verificações, saques, regras, exportação CSV), ações auditadas (`auditoria`, só INSERT), exclusão com cancelamento de saldo configurável, regras versionadas só para frente; migration 030. Visitas por mês: E8.
