# Mesclagem automática de documentação

Decisão do Marcos de 21/11/2026: PRs que alteram **somente documentação** podem ser mesclados automaticamente. Todo o resto (código, CI, `CLAUDE.md`, `.claude/**`, `.github/**`, migrações) continua sem merge sem ordem escrita dele.

Arquivos: `.github/workflows/mesclagem-automatica-docs.yml` e `.github/automacao/mesclagem_docs.py`.

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

- O workflow usa `pull_request_target`, então roda sempre a versão que está na `main`. Um PR que altere o workflow ou o script não muda as regras para ele mesmo, e ainda é recusado por mexer em `.github/**`.
- O código do PR nunca é baixado nem executado. O script lê só a lista de arquivos e o diff pela API do GitHub.
- Permissões mínimas: nenhuma no nível do workflow; o job pede só `contents: write` (mesclar) e `pull-requests: write` (ler os arquivos e comentar).
- A mesclagem usa o commit que foi verificado. Se alguém enviar um commit novo durante a verificação, o GitHub recusa a mesclagem e a verificação recomeça com o commit novo.

## Limites

- Um PR mesclado pelo robô não dispara outros workflows do GitHub. O deploy da Vercel não depende deles: ele vem do aplicativo da Vercel e acontece normalmente (só documentação, sem mudança de código).
- A varredura de segredos é heurística: reduz o risco, mas não substitui o cuidado de nunca escrever valores de segredos em documentos.
- Vale só para este repositório. Os outros repositórios da conta não têm o mecanismo.
