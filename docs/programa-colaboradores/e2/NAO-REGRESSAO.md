# Etapa E2 — Verificação de não regressão (23/11/2026)

Build e servidor locais (`next build` + `next start`), **Postgres local descartável** (nada em produção; a migration 026 e o seed só foram aplicados em bancos locais), Chromium em 375 px e 1280 px, rede externa bloqueada. **Não é Safari/iPhone e não é a Vercel.**

## 1. Linha de base (E1 aprovada, antes de qualquer alteração da E2)
| Item | Resultado |
|---|---|
| Suíte | 75 arquivos / 1.701 testes passam |
| `tsc` | 8 erros (os mesmos de sempre; pendência separada em `STATUS.md`) |
| Build | limpo |
| Cadastro de ocorrência sem código (7 pedidos representativos) | resposta e linha gravada guardadas em arquivo |
| Roteiro de formulário (`form.mjs`, 49 verificações) | passa |
| 8 rotas existentes × 375/1280 px, `sitemap.xml` | capturas, hash de texto e arquivo guardados |

## 2. Fluxos existentes tocados pela E2 e alteração, linha por linha
| Arquivo existente | Alteração |
|---|---|
| `src/app/sitemap.ts` | 1 `import` e 2 linhas: `const colaboradorUrls = await paginasDeColaboradorParaSitemap(BASE)` e o acréscimo dela ao array devolvido. **Com o interruptor desligado a função devolve `[]` sem consultar o banco**: o `sitemap.xml` é igual ao da linha de base (comparado: mesmo arquivo, mesmas 12 URLs; só mudam as datas `lastmod` geradas no build). |
| `src/app/admin/layout.tsx` | 1 `import` e o `<main>` passou a conter `<AvisoInterruptores />` antes de `{children}`. O componente **não renderiza nada** quando os interruptores estão iguais, quando a consulta falha ou quando a pessoa não é admin (teste: marcação vazia). |
| `src/components/colaboradores/CapturaCodigoColaborador.tsx` (da E1) | passou a rodar a cada mudança de página (`usePathname`), porque o botão da página do colaborador navega pelo roteador e a captura só rodava na primeira montagem (achado desta verificação). |
Arquivos **não** tocados: `POST /api/v1/objects`, formulário de cadastro, middleware, Feed (`getRankedFeed`, `FEED_SQL`, memória e página), cartaz, mapa, busca, matching, login/cadastro de conta, pagamento. A E2 só **usa** o que o Feed já exporta (`FEED_ELIGIBILITY_WHERE`, `toPublicItem`, `sourceName`).
Migração: **nenhuma nova** (a 026 é da E1, não aplicada em produção). Interruptores (ambos desligados por padrão; ligar **juntos**): `COLABORADORES_ATIVO=1` e `NEXT_PUBLIC_COLABORADORES_ATIVO=1`.

## 3. Depois da alteração
| Item | Resultado |
|---|---|
| Suíte | **78 arquivos / 1.734 testes passam** (+3 arquivos, +33 testes; nenhum teste antigo alterado). Um teste antigo do Feed (`feed-foto-moldura`) pegou o reaproveitamento do componente `FeedFoto` no cartão e foi respeitado: o cartão usa miniatura própria. |
| `tsc` | 8 erros, **idêntico** |
| Build | limpo, com o programa desligado e ligado |

## 4. Comparação (linha de base × E2 desligada × E2 ligada)
| Verificação | Resultado |
|---|---|
| **Cadastro de ocorrência SEM código** (os mesmos 7 pedidos) | **respostas e linhas gravadas byte a byte iguais** nos três (arquivos idênticos) |
| Roteiro de formulário `form.mjs` | **49/49 nas três builds** |
| 8 rotas existentes × 375/1280 px (status, URL final, título, texto) | **idênticos** nos três cenários; diferença de pixels ≤ 10 em poucas capturas (ruído de renderização) |
| **Feed geral** (`/feed` página e `/api/v1/feed`) | mesmo texto nos três; com o programa ligado, as ocorrências com código aparecem nele como as demais e a saída **não expõe** colaborador, código nem id |
| `sitemap.xml` desligado | idêntico ao da linha de base (ignorando só `lastmod` do build) |
| `/@backfindr` | desligado: 404 igual à linha de base; ligado: a página real (única diferença planejada) |
| Painel do admin | sem aviso com os interruptores iguais (desligados ou ligados); aviso só quando diferentes |
Diferenças não planejadas: **nenhuma**.
(Primeira rodada da comparação foi descartada: um erro meu no roteiro apontava o banco errado e fez o Feed da linha de base responder 500; corrigido e refeito.)

## 5. Testes do piloto cobertos na E2 (banco local descartável, 375 px)
| Teste pedido | Resultado |
|---|---|
| Cadastro pela `/@backfindr` com código preenchido | passa: o botão «Encontrei algo» leva a `/flow/found?colab=HX7R`; o código fica só na aba; o cadastro abre com o campo preenchido e «Colaborador: Backfindr»; grava `HX7R` |
| Digitando o @nome (maiúsculas) e o código curto (minúsculas) | passa: `@backfindr` e `HX7R` |
| Código inválido / colaborador inativo | passa: recusado, nada criado |
| Sem código | passa: igual à linha de base |
| Ocorrência visível no Feed geral | passa |
| Ocorrência visível na página do colaborador | passa: só as cadastradas com o código; a sem código não aparece |
| Região (raio configurável) | passa: depois das com código, as de São Paulo dentro do raio; nenhuma de fora (ex.: Rio de Janeiro) |
| Estados | suspenso → 307 para `/feed`; saiu → 308; inexistente → 404; `/@BackFindr` → 308 para `/@backfindr` |
| SEO | verificada + com conteúdo = `index, follow`; sem conteúdo = `noindex`; **não verificada, mesmo com conteúdo = `noindex`**; canônica `/@nome`; sitemap só com página ativa + verificada + com ocorrência elegível (teste de integração) |
| Cartaz com a marca | **E3** |
Dados descartáveis: só em bancos locais, removidos ao final.

## 6. Achados durante a verificação (nenhum afeta produção)
1. **Defeito corrigido:** a captura do `?colab=` não rodava na navegação interna por link (o botão da página usa o roteador).
2. O painel do admin quebra com respostas `{}` falsas nas APIs de estatística (erro do meu mock, não do aviso): com as APIs reais o painel e o aviso funcionam.
3. **Desvio do desenho:** o acesso direto a `/colaborador/<nome>` **não** redireciona 308 para `/@nome`; mostra a mesma página com a canônica apontando para `/@nome`. Um redirecionamento no middleware poderia entrar em laço com a regeneração estática (não testado) e um de configuração mudaria o comportamento com o programa desligado. A canônica evita conteúdo duplicado.
4. A página é estática com revalidação de 5 minutos (como o Feed): ocorrências novas, mudança de estado e verificação aparecem em até 5 minutos; um 404 gerado antes de a página existir também é guardado por esse prazo (a E1 já avisava).
5. O sitemap só ganha páginas de colaborador no ritmo em que o próprio sitemap é regenerado (não verificado se é a cada deploy ou por revalidação).

## 7. Não verificado (HIPÓTESE)
Comportamento na **Vercel** (será verificado **uma vez**, ao final do piloto, com todas as etapas, num banco isolado: ver `DESENHO.md` §10); Safari/iPhone; login com Google; Mapbox real; o tamanho/aparência da imagem do colaborador (a imagem é opcional e só será gravada pelo admin; sem imagem aparece a inicial do nome).
