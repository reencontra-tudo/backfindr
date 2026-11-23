# Etapa E0 — Verificação de não regressão (23/11/2026)

Build e servidor locais (`next build` + `next start`), banco local descartável, rede externa bloqueada no navegador (sem Mapbox nem rastreadores), Chromium em 375 px e 1280 px. **Não é Safari/iPhone e não é a Vercel.**

## 1. Linha de base (main, `5e0749c`)
| Item | Resultado |
|---|---|
| Suíte | 72 arquivos / 1.659 testes. Numa rodada completa `tests/scan-registro.test.ts` falhou uma vez (1 teste) e passou isolado e em todas as rodadas seguintes: intermitente, sem relação com esta etapa. |
| `tsc` | 8 erros (os mesmos de antes) |
| Build | limpo; 0 menções a «colaborador» |

## 2. Fluxos existentes tocados pela E0
Só **um arquivo existente de lógica**: `src/middleware.ts` (roda em todas as rotas, exceto `api`, `_next` e imagens) e **uma lista** em `src/lib/clarity.ts`. Nenhum fluxo de cadastro, pagamento, Feed, mapa, busca ou matching foi alterado.

| Arquivo existente | Alteração, linha por linha |
|---|---|
| `src/middleware.ts` linha 2 | `import` de duas funções puras do arquivo novo `src/lib/colaboradores/rota.ts`. |
| `src/middleware.ts` (antes `const response = NextResponse.next();`) | Passa a `let response = NextResponse.next();` (mesmo valor) seguido de um bloco `if (colaboradoresAtivo()) { … }`. O bloco só age se o caminho for exatamente `/@nome`: reescreve para `/colaborador/nome` ou redireciona 308 se houver maiúsculas. **Com o interruptor desligado, o bloco é ignorado e o restante da função é o mesmo de antes** (cookie de origem, redirecionamento de links antigos com token). |
| `src/lib/clarity.ts` | Duas linhas acrescentadas às listas: `/colaborador` em `CLARITY_PUBLIC_PREFIXES` e `colaborador` em `CLARITY_MASKED_SEGMENTS` (a guarda `tests/clarity.test.ts` exige uma decisão para toda pasta nova). Nenhuma regra existente mudou. |

Migrações: **nenhuma** nesta etapa. Interruptor: `COLABORADORES_ATIVO` (só liga com `1`); ausente = desligado.

## 3. Depois da alteração
| Item | Resultado |
|---|---|
| Suíte | **73 arquivos / 1.669 testes passam** (+1 arquivo, +10 testes novos; nenhum teste antigo mudou) |
| `tsc` | 8 erros (idêntico à linha de base) |
| Build | limpo |

## 4. Comparação dos fluxos (main × E0 desligada × E0 ligada)
Rotas: `/`, `/feed`, `/perdi` (redireciona para `/flow/lost`), `/achei`, `/pricing`, `/auth/login`, `/flow/found`, `/map`, mais `/@backfindr`. Em 375 px e 1280 px (18 capturas por cenário). Compara-se status, URL final, título, texto da página (hash) e pixels.

| Comparação | Resultado |
|---|---|
| Status e URL final das 8 rotas existentes | **idênticos nos três cenários** (inclui o 307 de `/perdi`) |
| Título e texto das 8 rotas existentes | **idênticos nos três cenários** |
| Pixels, main × E0 desligada | 0 de diferença em 15 das 16 capturas; 5 pixels em `/flow/found` 375 px (ruído de renderização) |
| Pixels, E0 desligada × E0 ligada | 0 em 14 das 16; 10 pixels na home 375 px e 1 pixel em `/auth/login` 375 px (ruído: o mesmo build, sem diferença de texto) |
| `/@backfindr` | **desligado: 404 em main e E0 (idênticos)**; **ligado: 200, página de prova «Prova técnica da rota (etapa E0)», `noindex`** (única diferença, a planejada) |
Diferenças não planejadas: **nenhuma**.

Prints (JPG reduzido) nesta pasta: Feed 375 px (main, E0 desligada, E0 ligada), home 1280 px (main, E0 ligada), `/flow/found` 375 px (main, E0 ligada), `/@backfindr` 375 px (desligada = 404; ligada = prova) e 1280 px (ligada).

## 5. Itens do protocolo que a E0 não alcança (ficam para a E1)
- Teste explícito do cadastro de ocorrência **sem** código (campos, validações, gravação, Feed, mapa, matching e notificações): a E0 não toca no cadastro; o teste é obrigatório na E1.
- Migração aditiva com caminho de reversão: não há migração na E0.

## 6. Não verificado (HIPÓTESE)
Comportamento na **Vercel** (prévia protegida por login; roteiro para o Marcos em `STATUS.md`); Safari/iPhone; Mapbox e rastreadores reais (bloqueados nos testes).
