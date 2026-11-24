# Levantamento (somente leitura): erros de `tsc` e testes pulados — 24/11/2026

Medido na `main` (`598841c`), árvore limpa, sem a pasta `.next`. **Nada foi corrigido.**

## A. Erros de `tsc`: são 14, e nenhum é novo
`npx tsc --noEmit -p .` = **14 erros = 8 em `src/` + 6 em `supabase/functions/`**. O «8» dos registros do piloto bate exatamente com a contagem só de `src/` (conclusão por conta: 14 − 6 = 8; não consegui ver como aquela contagem foi feita). O próprio STATUS de 04/11/2026 (PRs #82 a #87) já registrava «`tsc` com 14 erros já existentes». **Os 6 «a mais» não entraram em PR nenhum do piloto:** são o arquivo Deno `supabase/functions/notify-boost-expiration/index.ts`, criado em **21/05/2026** (commit `111bdcd`), e o `tsconfig.json` inclui `**/*.ts` desde abril.

| # | Arquivo:linha | Mensagem | Origem (linha atual veio de) |
|---|---|---|---|
| 1 | `src/app/admin/comunidade/page.tsx:389` | `Property 'id' does not exist on type 'PostForm'` | `45be498` (30/05/2026, «bot + matching + gerador IA...») |
| 2 | `src/app/api/v1/comunidade/posts/[slug]/route.ts:17` | `Property 'role' does not exist on type 'TokenPayload'` | `d0b72cf` (30/05/2026, «admin pode visualizar rascunhos da comunidade») |
| 3 | idem `:17` (2ª ocorrência) | idem | idem |
| 4 | `src/app/comunidade/[slug]/PostClient.tsx:458` | `Property 'debate_question' does not exist on type 'Post'` | `e3b38a2` (31/05/2026, «pergunta de debate...») |
| 5 | idem `:461` | idem | idem |
| 6 | `src/app/dashboard/layout.tsx:228` | comparação sem sobreposição entre `UserRole \| undefined` e `"superadmin"` | `33af891` (29/05/2026, «menu usuário...») |
| 7 | `src/app/dashboard/objects/[id]/page.tsx:477` | comparação sem sobreposição de categoria (`'animal'`) | `bf5a257` (25/06/2026, «boost copy contextual...») |
| 8 | `src/app/dashboard/objects/[id]/page.tsx:641` | `ActivityCenterCard`: props `matchCount/scanCount/shareCount` não aceitas | `a76e841` (25/06/2026, «Centro de Atividade... Sprint A») |
| 9 a 14 | `supabase/functions/notify-boost-expiration/index.ts:1,2,17,24,25,154` | módulos Deno (`deno.land`, `esm.sh`) não resolvidos, `Deno` não definido, `req` implícito `any`, `error` `unknown` | `111bdcd` (21/05/2026, «Refactor: Improve object details UI...») |
(A coluna «Origem» é o commit que escreveu a linha hoje, por `git blame`; é o ponto de partida mais provável do erro, não prova de que um tipo mudou depois.)

**Por que ninguém viu:** `next.config.js` tem `typescript.ignoreBuildErrors: true` e não existe CI que rode `tsc` nem testes (só `deploy-vercel.yml` e `deploy-render.yml`).

**Proposta (não aplicada):** (1) excluir `supabase/functions` do `tsconfig.json` (é código Deno, roda em outro ambiente): cai para 8; (2) corrigir os 8 de `src/` num PR próprio (tipos de `TokenPayload.role`, `Post.debate_question`, `PostForm.id`, `UserRole`/`superadmin`, categoria `animal`, props do `ActivityCenterCard`), cada um com teste de não regressão; (3) só então ligar `tsc` num CI e tirar o `ignoreBuildErrors`.

## B. Testes: 1.748 = 1.278 passam + 470 pulados de propósito + 0 falhando
Medido com `vitest -c tests/vitest.config.ts` na `main`: **1.278 passam, 0 FALHAM, 470 pulados (24 arquivos)**.
- **Pulados de propósito:** todos os 24 arquivos usam `describe.skipIf(!TEST_DATABASE_URL)`: são os testes «com banco real» e só rodam se existir um Postgres de teste com as migrations (`TEST_DATABASE_URL`). Sem a variável, pulam. Por arquivo (pulados): conversas 125, email-higiene 49, matching-novos-e-datas 40, colaboradores-atribuicao 25, validade-links 24, feed-busca 22, matching-sinal-sinal 21, feed 19, matching-religar 19, platform-messages 16, flow-match-relevance 15, scan-registro 14, colaboradores-pagina 13, objects-similar 10, documento-titular-status 9, sinonimos-etapa1 8, colaboradores-marca 7, colaboradores-pagina-render 7, documento-privacidade 7, links-custodia-entrega 7, feed-apresentacao 5, achei-contexto 4, admin-feed-contagem 3, colaboradores-e2-guardas 1.
- **Falhando de verdade: nenhum.** (Rodar sem `-c tests/vitest.config.ts` dá dezenas de falhas falsas, por falta do alias `@/`: o arquivo de configuração fica em `tests/`, não na raiz.)
- **Os «1.748 passam» dos registros do piloto** foram rodados com banco local descartável (E0 a E3); **não reexecutei os 470 nesta sessão** (não verificado agora).
- **Risco:** não há CI que rode testes; o teste `scan-registro` já tinha uma falha intermitente registrada.

**Proposta (não aplicada):** job de CI com Postgres de serviço aplicando as migrations, `TEST_DATABASE_URL` apontando para ele, rodando `vitest -c tests/vitest.config.ts` e `tsc`; mover (ou apontar) a configuração do vitest para a raiz/`package.json` (`"test"` hoje nem existe); até lá, rodar os 470 com banco local antes de cada mescla.
