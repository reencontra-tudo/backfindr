# Mesclagem automática de documentação

Decisão do Marcos de 21/11/2026: PRs que alteram **somente documentação** podem ser mesclados automaticamente. Todo o resto (código, CI, `CLAUDE.md`, `.claude/**`, `.github/**`, migrações) continua sem merge sem ordem escrita dele.

Arquivos:
- `.github/workflows/mesclagem-docs-gatilho.yml`: gatilho sem nenhuma permissão, disparado quando um PR para a `main` é aberto ou muda;
- `.github/workflows/mesclagem-automatica-docs.yml`: executor, disparado quando o gatilho termina, que verifica e mescla;
- `.github/automacao/mesclagem_docs.py`: as regras.

## Quando o PR é mesclado sozinho

Só quando **todas** as condições abaixo forem verdadeiras:

1. O PR vem de uma branch deste repositório (nunca de fork), foi aberto pela conta `reencontra-tudo` e vai para a `main`.
2. **Todos** os arquivos alterados estão nesta lista:
   - `STATUS.md`, `DECISOES.md`, `ESTADO-ATUAL.md`, `BACKFINDR.md`, `PENDENCIAS.md` (na raiz);
   - qualquer arquivo `.md` dentro de `docs/`.
3. Nenhum arquivo foi apagado ou renomeado.
4. A varredura de segredos nas linhas adicionadas não achou nada: chaves privadas, chaves e tokens conhecidos (AWS, GitHub, OpenAI/Anthropic, Stripe, Slack, Google, Supabase, Resend), JWT, cabeçalho `Authorization`/`Bearer` com valor, URL com senha, atribuição do tipo `SENHA=valor`, hexadecimal com 32 caracteres ou mais e base64 longo.
5. O PR não está em rascunho e não tem o rótulo `nao-mesclar`.

Se tudo passar, o PR é mesclado por **squash** e recebe o comentário "mesclado automaticamente: só documentação". A branch não é apagada.

Se algo falhar, nada acontece: o PR fica aberto para merge à mão e o motivo aparece no resumo da execução (aba Actions). Quando o PR é só de documentação e a recusa vem da varredura de segredos, o PR também recebe um comentário com arquivo e linha. O valor suspeito nunca é mostrado.

## Exemplos de recusa

- Qualquer arquivo fora da lista: `CLAUDE.md`, `README.md`, `.claude/settings.json`, `.github/**`, `src/**`, `supabase/migrations/**` e até um `.sql` dentro de `docs/`.
- Um hash completo de commit (40 caracteres) conta como "hexadecimal longo". Use o hash curto (7 caracteres) nos documentos.
- Valores escritos como modelo, só com maiúsculas e sublinhado (por exemplo `Bearer COLOQUE_AQUI`), **não** contam como segredo.

## Como impedir que um PR de documentação seja mesclado sozinho

Abra como rascunho ou ponha o rótulo `nao-mesclar`.

## Como desfazer

- **Um PR mesclado sozinho:** abra um PR novo com `git revert <commit do squash>` (o commit aparece no PR e no comentário). Se o revert também só mexer em documentação, ele passa pela mesma mesclagem automática.
- **Desligar o mecanismo:** no GitHub, aba Actions → "Mesclagem automática de documentação" → "Disable workflow". Volta a funcionar com "Enable workflow". Não apaga nada.
- **Retirar de vez:** PR que reverte o commit que criou estes arquivos. Ele mexe em `.github/**`, por isso precisa de merge à mão.

## Segurança

- O executor é disparado pelo evento `workflow_run`, que roda sempre a versão que está na `main`. Um PR que altere o gatilho, o executor ou o script não muda as regras para ele mesmo, e ainda é recusado por mexer em `.github/**`.
- O gatilho roda a versão do próprio PR, mas não tem nenhuma permissão e não faz nada além de registrar o número do PR.
- Não usa `pull_request_target`: o GitHub anunciou, em 02/11/2026, o bloqueio desse evento por padrão em repositórios públicos a partir de 02/12/2026 (a página do aviso está marcada como "Retired"; a vigência não foi confirmada).
- Só é mesclado o commit que disparou a verificação. Se o PR recebeu um commit novo no meio do caminho, nada é mesclado e a verificação do commit novo decide.
- O código do PR nunca é baixado nem executado. O script lê só a lista de arquivos e o diff pela API do GitHub.
- Permissões mínimas: nenhuma no nível do workflow; o job pede só `contents: write` (mesclar) e `pull-requests: write` (ler os arquivos e comentar).

## Limites

- O mecanismo só passa a funcionar depois que estes arquivos estiverem na `main`: o GitHub só roda workflows `workflow_run` a partir da branch padrão. O teste de 21/11/2026 usou uma branch de teste em que o executor era disparado direto pelo PR (detalhes no PR que criou o mecanismo).
- Se o rótulo `nao-mesclar` for posto nos segundos em que a verificação já está rodando, ela pode terminar antes de ver o rótulo. Para garantia total, abra o PR como rascunho.

- Um PR mesclado pelo robô não dispara outros workflows do GitHub. O deploy da Vercel não depende deles: ele vem do aplicativo da Vercel e acontece normalmente (só documentação, sem mudança de código).
- A varredura de segredos é heurística: reduz o risco, mas não substitui o cuidado de nunca escrever valores de segredos em documentos.
- Vale só para este repositório. Os outros repositórios da conta não têm o mecanismo.
