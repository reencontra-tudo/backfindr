# Etapa E1 — Verificação de não regressão (23/11/2026)

Build e servidor locais (`next build` + `next start`), **Postgres local descartável** (nada em produção), Chromium em 375 px e 1280 px, rede externa bloqueada. **Não é Safari/iPhone e não é a Vercel.** A migration 026 foi aplicada **somente** em bancos locais de teste; **não foi aplicada em produção**.

## 1. Linha de base (antes de qualquer alteração da E1)
Código da E0 (aprovada), que nos arquivos tocados pela E1 é igual à `main`.
| Item | Resultado |
|---|---|
| Suíte | 73 arquivos / 1.669 testes passam |
| `tsc` | 8 erros (os mesmos de sempre; pendência separada em `STATUS.md`) |
| Build | limpo |
| Cadastro de ocorrência (7 pedidos representativos: chaves, pet com coordenadas, documento «encontrei», carteira roubada com recompensa, campo desconhecido, bike protegida, pedido inválido) | resposta e linha gravada guardadas em arquivo para comparação |
| Roteiro de formulário no navegador (`form.mjs`: found, lost, stolen, keys, wallet, phone, bike, pet, vehicle, protect, «+», visitante) | 49 verificações passam |
| Telas (8 rotas × 375/1280 px) | capturas e hash de texto guardados |

## 2. Fluxos existentes tocados pela E1 e alteração, linha por linha
| Arquivo existente | Alteração |
|---|---|
| `src/app/api/v1/objects/route.ts` | (1) 2 `import` do código novo. (2) Na desestruturação do corpo, acrescenta `colaborador_codigo: colaboradorCodigoBruto`: é isso que **tira a chave de `categoryFields`**, então ela nunca vai para `category_fields`. O resto da desestruturação e o comportamento para campos desconhecidos **não mudaram**. (3) Bloco de 8 linhas logo depois da checagem de título/categoria: só com `COLABORADORES_ATIVO=1` e com texto no campo, resolve o colaborador **ativo** no servidor; inválido ou inativo = resposta 400 `CODIGO_COLABORADOR_INVALIDO` e **nada é criado**. Sem texto ou desligado: nenhuma consulta nova. (4) O `INSERT` virou um ternário: **com colaborador** usa um comando próprio com as 2 colunas novas no mesmo `INSERT`; **sem colaborador executa exatamente o comando original, byte a byte**. |
| `src/app/dashboard/objects/new/page.tsx` | (1) 2 `import`. (2) Campo opcional `colaborador_codigo` no esquema do formulário. (3) No efeito de preenchimento inicial: 3 linhas que leem o código da URL (`?colab=`) ou da aba, **só com o programa ligado no navegador** (desligado, a função devolve sempre `null`). (4) 2 linhas de estado. (5) 1 linha no corpo do envio: acrescenta `colaborador_codigo` **só se o programa estiver ligado e o campo tiver texto**. (6) 1 linha que limpa o código guardado depois de criar a ocorrência. (7) Tratamento do erro `CODIGO_COLABORADOR_INVALIDO`: volta ao último passo e mostra o aviso (os demais erros seguem o caminho de antes). (8) O campo, no fim do último passo, **só se o programa estiver ligado**. |
| `src/app/layout.tsx` | 2 `import` e 1 linha: `{colaboradoresAtivoNoCliente() && <CapturaCodigoColaborador />}`. Desligado, nada é renderizado. |
Arquivos **não** tocados: middleware, Feed, cartaz, mapa, busca, matching, login/cadastro de conta, pagamento, admin.

Migração: `src/db/migrations/026_colaboradores.sql`, **aditiva** (tabela nova `colaboradores`; 2 colunas **nulas** em `objects`; índice parcial; gatilho de imutabilidade que só dispara quando uma dessas colunas muda; função e gatilho que impedem apagar colaborador). **Caminho de reversão** descrito no próprio arquivo e **testado** (os comandos de reversão rodam e o `objects` volta ao que era; reaplicar funciona). **NÃO aplicada em produção.**
Interruptores (ambos desligados por padrão; ligar **juntos**): `COLABORADORES_ATIVO=1` (servidor: middleware, validação, cadastro) e `NEXT_PUBLIC_COLABORADORES_ATIVO=1` (navegador: campo e captura; fixado na hora do build).

## 3. Depois da alteração
| Item | Resultado |
|---|---|
| Suíte | **75 arquivos / 1.701 testes passam** (+2 arquivos, +32 testes novos; nenhum teste antigo alterado) |
| `tsc` | 8 erros, **idêntico** |
| Build | limpo, com o programa desligado e ligado |

## 4. Comparação (linha de base × E1 desligada × E1 ligada)
| Verificação | Resultado |
|---|---|
| **Cadastro de ocorrência SEM código**: os mesmos 7 pedidos contra a linha de base e contra a E1 (interruptor desligado e ligado) | **respostas e linhas gravadas byte a byte iguais** nos três (arquivos idênticos) |
| Testes explícitos do cadastro sem código (`tests/colaboradores-atribuicao.test.ts`) | criação 201, atribuição nula, mesmos campos de resposta, `category_fields` igual ao de antes, desligado = ligado; código vazio/só espaços = sem código |
| Roteiro de formulário `form.mjs` (49 verificações) | **49/49 nas três builds** (linha de base, E1 desligada, E1 ligada) |
| Roteiro da E1 com o programa desligado, rodado também **contra a linha de base** | passa igual: sem campo, `?colab=` não é guardado, ocorrência criada, sem `colaborador_codigo` no envio, gravada sem atribuição, validação responde 404 |
| 8 rotas existentes × 375/1280 px (status, URL final, título, texto) | **idênticos** nos três cenários; diferença de pixels ≤ 10 em 4 capturas (ruído de renderização), 0 nas demais |
| `/@backfindr` | desligado: 404 igual à linha de base; ligado: página de prova da E0 (única diferença, planejada) |
Diferenças não planejadas: **nenhuma**.

## 5. Testes do piloto cobertos na E1 (banco local descartável, navegador 375 px)
| Teste pedido | Resultado |
|---|---|
| Cadastro com código preenchido pelo link (`?colab=`) | passa: o código fica só na aba; o formulário abre com ele preenchido e mostra «Colaborador: Backfindr»; grava `colaborador_id` e `ZL27`; a chave **não** aparece em `category_fields`; nenhum cookie novo; o código sai da aba depois de criar |
| Digitando o @nome (inclusive com maiúsculas) | passa: grava `@backfindr` |
| Digitando o código curto (inclusive minúsculas) | passa: grava `ZL27` |
| Código inválido | passa: aviso no campo, o servidor recusa (400), **nada é criado**, continua no último passo; apagando o campo, cria sem código |
| Colaborador inativo (suspenso; no teste de integração também «saiu» e «excluído») | passa: recusado com a **mesma** resposta do código inexistente |
| Código imutável | passa: `UPDATE` direto recusado pelo banco (troca, apagar, e nulo → valor); demais `UPDATE` de `objects` seguem normais; colaborador nunca é apagado |
| Aviso de objeto parecido (409) | passa: o reenvio confirmado mantém o código |
| Ocorrência visível no Feed geral | passa (5/5 com o filtro Achados + Chaves), e a saída pública do Feed **não expõe** colaborador, código nem id |
| Página do colaborador / cartaz com marca | **não fazem parte da E1** (E2 e E3) |
Dados descartáveis: criados só em bancos locais, removidos ao final.

## 6. Achados durante a verificação (nenhum afeta produção)
1. O layout raiz é estático: usar `COLABORADORES_ATIVO` (variável de servidor) para decidir sobre o componente de captura só valeria no momento do build. Corrigido: o layout usa só o interruptor do navegador (também fixado no build), como todo o lado do navegador.
2. Ligar o programa exige **as duas variáveis juntas**; só uma ligada não quebra nada (o servidor recusa ou ignora; o navegador não mostra o campo).
3. O Feed guarda a leitura em memória por 120 s (regra do Feed): ocorrências novas aparecem depois desse intervalo, igual a qualquer ocorrência.
4. A validação limita 30 pedidos por minuto por origem **em memória de cada instância do servidor** (mesma limitação já documentada do `/achei`): freia varredura simples, não é barreira global.

## 7. Não verificado (HIPÓTESE)
Comportamento na **Vercel** (prévia protegida; precisa das duas variáveis só na prévia da branch e da migration 026 em um banco que a prévia use, o que depende de ordem do Marcos); Safari/iPhone; login com Google (a captura em `sessionStorage` foi testada com navegação normal, não com o desvio real pelo Google); Mapbox real.
