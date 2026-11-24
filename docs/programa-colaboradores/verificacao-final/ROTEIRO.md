> **SUPERADO em 24/11/2026.** A verificação isolada no projeto «Resolve Tudo» foi **CANCELADA pelo fundador**; **nada foi executado lá, não há nada a limpar** (decisão PC-10 em `DECISOES.md`). Este arquivo fica só como registro. Caminho atual: `../LANCAMENTO-CONTROLADO.md`.

# Verificação final do piloto na Vercel — roteiro (23/11/2026)

> **A versão final, em linguagem simples e passo a passo, é `ROTEIRO-SIMPLES.md`.** Este arquivo guarda o levantamento e as justificativas (isolamento de arquivos e mensagens, variáveis, riscos). A linha de base do «Resolve Tudo» está em `LINHA-DE-BASE-ANTES.md` (leitura feita pelo fundador em 23/11/2026; o conector não conseguiu autenticar).

**Estado: ROTEIRO PRONTO; NADA FOI EXECUTADO.** Executa-se **uma vez**, depois da E3 aprovada e com as etapas E0 a E3 juntas, numa prévia da branch do piloto apontada para um **banco isolado**. Marcação: **[F]** = ação do fundador (só ele tem o acesso ou a decisão); **[C]** = eu executo; **[F+C]** = o fundador no navegador logado, com o meu apoio (como na verificação da E0).

## 0. Regras que valem o tempo todo
1. **Nenhum teste que escreva dados em prévia apontada para o banco da produção** (confirmado em 23/11/2026: existe uma única `DATABASE_URL`, com escopo «All Environments»; portanto TODAS as prévias usam o banco da produção).
2. **A migration 026 e o seed só entram no banco isolado.** Nunca no banco da produção sem ordem escrita.
3. **O Storage do «Resolve Tudo» e seus documentos não são tocados de forma alguma.** O teste só usa um schema próprio de banco (`backfindr_teste`) e um papel próprio; nenhuma consulta lê o Storage.
4. **Parar e avisar** se: aparecer qualquer tabela ou dado inesperado no «Resolve Tudo»; a prova de isolamento falhar; qualquer sinal de que algo chegou à produção (ocorrência, imagem, e-mail, evento); a prévia mostrar dados reais.

## 1. O que foi apurado nesta sessão
### 1.1 Banco do «Resolve Tudo» (somente leitura) — **FEITO pelo fundador em 23/11/2026**
O conector não conseguiu autenticar no banco do «Resolve Tudo» (quatro tentativas), então o fundador rodou o `catalogo-resolve-tudo.sql` no SQL Editor do painel. **Resultado: nenhum objeto em `public`, nenhuma tabela fora dos schemas internos do Supabase, nenhuma função, política ou gatilho fora deles, nenhum papel não padrão, sem colisão (`backfindr_teste` e `backfindr_teste_app` não existem), e `pg_trgm` NÃO existe (o teste a cria e a limpeza a remove).** A assinatura do catálogo ficou registrada como linha de base em `LINHA-DE-BASE-ANTES.md`. O Storage nunca foi consultado.

### 1.2 Isolamento de arquivos, mensagens, pagamentos e análise (levantamento no código, 23/11/2026)
| Canal | O que o código faz | Como o teste fica isolado |
|---|---|---|
| **Imagens** (`/api/v1/objects/[id]/images`) | Se `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` existem, **grava no Cloudflare R2** (bucket `R2_BUCKET_NAME`, padrão `backfindr-media`); senão (ou se o envio falhar) grava Base64 no banco. Na prévia essas variáveis são as da produção. | (1) **O roteiro de testes NÃO anexa fotos.** (2) Rede de segurança: na prévia do piloto, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` = `DESATIVADO-TESTE` (o envio falha antes de sair da máquina e o código cai no Base64 do banco de teste; testado localmente, ver §4). Atenção: a resposta da API diz `"storage":"r2"` mesmo quando caiu no Base64 (o campo reflete a configuração, não o resultado); para conferir, olhar o banco e o log, não esse campo. |
| **E-mail** (Resend, `RESEND_API_KEY`) | Envia aos endereços que estão no banco. O banco de teste só tem as contas de teste. | `RESEND_API_KEY` = `DESATIVADO-TESTE` na prévia do piloto: o provedor recusa e o código segue sem enviar (testado localmente). Contas de teste com endereços descartáveis de qualquer forma. |
| **Push** (VAPID) | Só envia para inscrições gravadas no banco; o banco de teste não tem nenhuma. | Nada a alterar (não mexer nas chaves VAPID: com valor inválido o módulo pode falhar ao carregar). |
| **WhatsApp** | Só monta links `wa.me` no navegador; **não há envio pelo servidor**. | Nada a alterar. |
| **n8n / Telegram / posts sociais** | O cadastro grava na fila `social_posts` (tabela **inexistente** na produção hoje; no banco de teste também não existe); o envio só ocorre por rotina agendada, que o n8n dispara contra o domínio da produção, nunca contra a prévia. | Nada a alterar. |
| **Pagamentos** (Mercado Pago, Stripe) | `payments_enabled` vem do banco: no teste, `false` (o «ampliar alcance» entra em modo de teste, sem cobrança). Mas o `MP_ACCESS_TOKEN` da prévia é o da produção e a `notification_url` aponta para `backfindr.com`. | **Não usar pagamento no teste.** Rede de segurança: `MP_ACCESS_TOKEN` e `STRIPE_SECRET_KEY` = `DESATIVADO-TESTE` na prévia do piloto. |
| **IA** (`MATCHING_ATIVO`, Anthropic/OpenAI) | Com `MATCHING_ATIVO=1` (produção), o cadastro chama o matching **no domínio de `NEXT_PUBLIC_APP_URL` (produção)** com o token do usuário. | `MATCHING_ATIVO` = `0` na prévia do piloto (sem chamada cruzada, sem custo, sem aviso). |
| **Análise** (GA4, Meta Pixel, PostHog) | Carregam na prévia com os identificadores da produção (só o Clarity é limitado ao domínio oficial). | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID` e `NEXT_PUBLIC_POSTHOG_KEY` = `DESATIVADO-TESTE` na prévia do piloto (opcional, evita poluir as métricas). |
| **Login com Google** | O endereço de retorno é o da produção. | Não usar; criar conta por e-mail e senha no banco de teste. |
| **Sitemap** | Lê a lista de ocorrências da API **da produção** (endereço fixo) e acrescenta só as páginas de colaborador do banco de teste. | Esperado; não indica vazamento. |
Os valores `DESATIVADO-TESTE` são **HIPÓTESE até a Vercel aceitá-los** (ela pode recusar valores vazios; um texto qualquer deve servir). O comportamento do código com esses valores foi **testado localmente** (§4).

## 2. Quem faz o quê
| # | Passo | Quem | Observação |
|---|---|---|---|
| 1 | Acordar o projeto e rodar `catalogo-resolve-tudo.sql`; colar o resultado | **[F]** | Bloqueio: sem isto nada começa. Guardar o resultado como **linha de base** |
| 2 | Conferir o resultado (sem tabelas, sem colisões) | **[C]** | Se houver qualquer coisa, parar |
| 3 | Gerar o esquema do Backfindr (só esquema, sem dados): `psql "<banco do Backfindr>" -At -c "SET search_path = public" -f gerar-esquema.sql > esquema.sql` | **[F]** (a conexão com o banco do Backfindr é do fundador) ou **[C]** pelo conector (leitura, sem segredo) | Método **ensaiado localmente**: o esquema gerado, aplicado num schema dedicado, ficou com assinatura idêntica à da origem em colunas, índices, restrições, gatilhos e funções |
| 4 | Rodar `preparar-schema-teste.sql` (cria o schema `backfindr_teste` e o papel `backfindr_teste_app`); **escolher a senha no próprio editor** | **[F]** | A senha nunca vai para o chat |
| 5 | Aplicar `esquema.sql`, a 026 e o seed (ver `aplicar-esquema-e-026.md`) | **[F]** (colar no editor) ou **[C]** se o conector for restaurado | |
| 6 | Conferir a assinatura do esquema (`comparar-esquema.sql`, origem × destino) | **[C]** (o fundador cola os resultados) | |
| 7 | Copiar a cadeia de conexão do papel `backfindr_teste_app` (Painel → Connect) e criar a variável **direto na Vercel**; testar a conexão | **[F]** | Nunca colar a cadeia no chat |
| 8 | Criar as variáveis da prévia (§3), **com o filtro de Git Branch** da branch do piloto | **[F]** | Só ele tem a Vercel |
| 9 | Deploy da prévia (o envio da branch já cria); eu leio o endereço no comentário da Vercel e libero o acesso da sessão | **[C]** | A prévia é protegida por login: os testes no navegador são do fundador |
| 10 | **Prova de isolamento** (§5) | **[F+C]** | Antes de qualquer cadastro |
| 11 | Roteiro de testes (§6) | **[F+C]** | |
| 12 | Reversão e limpeza (§7) | **[F]** (Vercel e SQL) e **[C]** (conferência) | |

## 3. Variáveis da prévia (ambiente **Preview**, filtro **Git Branch = `claude/backfindr-colaboradores-e3`**; nada em Production nem nas outras prévias)
| Variável | Valor | Para quê |
|---|---|---|
| `DATABASE_URL` | cadeia do papel `backfindr_teste_app` (**secreta**, direto na Vercel) | banco isolado |
| `COLABORADORES_ATIVO` | `1` | interruptor do servidor |
| `NEXT_PUBLIC_COLABORADORES_ATIVO` | `1` | interruptor do navegador (**ligar junto**; o admin avisa se divergirem) |
| `MATCHING_ATIVO` | `0` | sem chamada cruzada à produção nem IA |
| `RESEND_API_KEY` | `DESATIVADO-TESTE` | nenhum e-mail sai |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `DESATIVADO-TESTE` | nenhuma imagem vai ao R2 da produção |
| `MP_ACCESS_TOKEN`, `STRIPE_SECRET_KEY` | `DESATIVADO-TESTE` | nenhum pagamento |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_POSTHOG_KEY` | `DESATIVADO-TESTE` | sem métricas da produção |
A Vercel permite variáveis de Preview por branch e a específica de uma branch prevalece sobre a de «todas as branches» (**documentação da Vercel, não conferida aqui**; por isso a prova de isolamento do §5 vem antes de tudo). Variáveis `NEXT_PUBLIC_*` são fixadas no **build**: depois de criar ou mudar uma, refazer o deploy da prévia.

## 4. Ensaio local já feito (sem tocar em produção nem no «Resolve Tudo»)
- **Cópia do esquema:** gerador de DDL por catálogo → aplicado num schema dedicado de um banco local descartável → assinaturas (colunas, índices, restrições, gatilhos, funções) **idênticas** às da origem; nada foi criado fora do schema dedicado.
- **Isolamento com os valores `DESATIVADO-TESTE` (R2, Resend, Mercado Pago, Stripe, matching desligado):** testado localmente na E3 (`e3/NAO-REGRESSAO.md` §6): o cadastro com código funciona, o upload de foto cai no Base64 do banco de teste e nada é enviado ao R2; o cartaz com a marca sai. **Não executado localmente:** o envio real de e-mail (só leitura do código: com chave inválida o provedor recusa e o código segue) e o pagamento.
- **Reversão da 026:** testada (`tests/colaboradores-atribuicao.test.ts`).

## 5. Prova de isolamento (antes de qualquer cadastro) — **[F+C]**
1. No SQL Editor do «Resolve Tudo», como `backfindr_teste_app`, inserir uma **ocorrência-marca** em `backfindr_teste.objects` (pública, «achado», com código QR próprio, título «TESTE-ISOLADO-<sufixo aleatório>»).
2. **Esperado:** a marca aparece na prévia da branch do piloto (`/api/v1/feed?status=found` ou `/feed` depois de até 5 min) e **não aparece** em `https://backfindr.com/api/v1/feed` nem na prévia de **outra** branch. [C] confere `backfindr.com` por leitura.
3. **Esperado também:** uma ocorrência conhecida da **produção** (por exemplo, a primeira do Feed de `backfindr.com`) **não** aparece na prévia do piloto.
4. Se qualquer item falhar: **parar**, remover as variáveis da prévia e avisar.

## 6. Roteiro de testes (na prévia da branch do piloto; contas de teste com e-mails descartáveis; **sem fotos, sem pagamento, sem Google**)
1. `/@backfindr` abre (200), com «por Backfindr», botões e sem ocorrências; `noindex` enquanto não há ocorrência com o código.
2. Pelo botão «Encontrei algo» da página: cadastro de conta (e-mail e senha) e de uma ocorrência; o campo «Código do colaborador» vem preenchido e mostra «Colaborador: Backfindr».
3. Outra ocorrência digitando `@backfindr`, outra com o código curto, outra **sem código**.
4. Código inválido e colaborador suspenso/«saiu» (alterar o estado no banco de teste): recusados, nada criado.
5. Imutabilidade: tentativa de `UPDATE` no SQL Editor das colunas do programa é recusada; um `UPDATE` de título/status funciona.
6. As ocorrências aparecem no Feed geral e na página do colaborador (só as com código); a sem código só no Feed.
7. Região: cadastrar um colaborador de teste com região e raio e conferir a ordem (com código primeiro, depois a região, nenhuma de fora do raio).
8. SEO: `index` só com colaborador verificado e com conteúdo; `noindex` para não verificado; 307/308/404 nos estados; sitemap com as páginas elegíveis.
9. **Cartaz (E3):** baixar o cartaz (3 formatos) de uma ocorrência **com** código: leva «Divulgado por <nome>»; de uma **sem** código: idêntico ao atual; `?publico=1` também.
10. Admin (conta admin de teste): sem aviso com os dois interruptores iguais.
11. **Não regressão na prévia:** cadastro sem código, Feed, `/achei`, `/perdi`, login por e-mail, painel do usuário, mapa e busca funcionam como na produção (comparar com `backfindr.com`, só leitura).
12. Conferir no painel do Resend/Cloudflare/Mercado Pago e nas métricas que **nada novo chegou** da prévia.

## 7. Reversão e limpeza — deixar o «Resolve Tudo» como estava
1. **[F]** Apagar da Vercel as variáveis do §3 (todas as que têm o filtro da branch do piloto). Conferir que Production e as demais prévias não mudaram.
2. **[F]** Rodar `limpar-schema-teste.sql` (apaga o schema `backfindr_teste` inteiro, o papel e, só se foi o teste que a criou, a extensão `pg_trgm`).
3. **[F+C]** Rodar de novo `catalogo-resolve-tudo.sql`: as consultas 2 e 3 vazias e a **assinatura (consulta 6) igual à de antes**; **[C]** confere. O Storage nunca foi consultado nem alterado.
4. **[C]** Conferir `backfindr.com` por leitura: Feed, sitemap e `/@backfindr` (404) iguais ao início.
5. **[F]** Se foi criada branch/prévia só para o teste, decidir se mantém.
6. Registrar o resultado em `DESENHO.md`, `STATUS.md` e `BACKFINDR.md` (**[C]**).

## 8. Não verificado (HIPÓTESE)
Acesso do conector ao «Resolve Tudo» (falhou); a Vercel aceitar os valores `DESATIVADO-TESTE` e dar prioridade à variável da branch; conexão do papel `backfindr_teste_app` pela cadeia de conexão do Supabase (o formato do usuário no pooler); `grant ... to postgres` e `set role` no Supabase; se a Vercel alcança o banco pela rede escolhida (IPv4/IPv6 do Supabase); comportamento da prévia protegida por login com o meu apoio no navegador.
