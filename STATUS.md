# STATUS — Backfindr
Atualizado: 09/10/2026 19:47
Prioridade no portfólio: P1 (definido por Marcos em 01/10/2026)
Fase: em produção (backfindr.com, Vercel, banco Supabase, automações no n8n do Railway `backfindr-n8n`). Produção = deployment `dpl_9LdFSc91bFhzv6YU3oPTUf1g2BKn`, Ready, criado em 01/10/2026 09:10, commit 95f7474 [V: `vercel inspect` de 09/10/2026; `/api/health` 200, banco ok, 25 ms, curl de 09/10/2026 22:44Z]. Frente ativa: integração por lotes dos 15 commits locais de 29/07–04/08 + endurecimento de e-mail (PRs #35 a #38).
Objetivo atual: integrar os 15 commits locais por lotes, sem regressão e com aprovação por lote, e fechar o endurecimento do e-mail antes de o remetente `.com.br` entrar em produção.
Próximo passo exato: AGUARDANDO O MARCOS decidir o M2 (limite de e-mail de boas-vindas por IP; opções A–E, `~/auditoria/produto/backfindr-integracao-5a-lote2-lote3-barra-forte-08102026.md` §2.3; recomendação A + C). Sem a decisão o Code não implementa o M2 nem executa teste real. Quando chegar a escolha A: novo commit separado em `integracao/lote-5a-email-hardening`, em `src/app/api/v1/auth/register/route.ts` (chamada de `sendWelcomeEmail`, ~linha 66), reutilizando `user_lifecycle_events`, sem migration, com testes de stub (6 cadastros do mesmo destinatário ≤ 1 e-mail; cadastro legítimo idêntico), tsc/build, e atualizar o PR #36.
Feito na última sessão (08–09/10/2026):
- 08/10: Passo Zero e Lotes 1 e 5 preparados; PR #35 (Lote 5, remetente `noreply@backfindr.com.br`, f94a0d1) aberto, sem merge. Lote 1 (documentação, 10 commits, `integracao/lote-1-docs`, 71c7faa) publicado, sem PR.
- 08/10: PR #36 (rascunho, Lote 5a, `integracao/lote-5a-email-hardening`): M1 = escape de HTML e remoção de CR/LF nos assuntos em `src/lib/email.ts` (9c950b6). M2 parou por falta de mecanismo de limite (decisão do Marcos: parar e propor).
- 08/10: PR #37 (Lote 2, `integracao/lote-2-ga4-evento`): GA4 `ocorrencia_publicada` (75af0ad) + deduplicação por objeto por sessão (23a9e30); o Google Ads (7a00975) ficou de fora e continua na branch de resgate.
- 09/10: PR #36 ganhou o commit 9b2455f (escape do nome em magic-link e forgot-password; dado de terceiro, remetente já `.com.br`).
- 09/10: PR #38 (rascunho, Lote 3, `integracao/lote-3-canonical`, b1be7c9): canonical padronizado em `https://backfindr.com`; 8 páginas mudam; sem BACKFINDR.md e sem as 2 linhas `www` de `email.ts`.
- 09/10: issues #39 (sitemap com 500× `/objeto/undefined`) e #40 (`/blog` e posts com canonical = home), só investigação, nada implementado.
- 09/10: branch descartável `integracao/teste-5a-mais-35` (65e2535; 5a + #35; NUNCA mesclar) com preview READY; nenhum teste real executado.
- Todos os `tsc` com o mesmo conjunto do baseline (14 erros; 19 se contar os 5 de `.next/types` que o build gera, também na `main`); builds exit 0; testes com stub, sem e-mail real.
- Relatórios: `~/auditoria/produto/backfindr-integracao-*-08102026.md` e `backfindr-cadeia-devolucao-fase1-08102026.md` (fora de repositório).
Pendências (em ordem de prioridade):
- Marcos: decidir o M2 (cartão no quadro). O limite por destinatário só pode ser validado depois do M2.
- Marcos: OK específico por teste real (testes 1 a 3, §6 do relatório) com as duas contas autorizadas; ou rodar `~/auditoria/produto/cadeia-barra-forte-leitura-08102026.sql` / criar papel de banco somente leitura (cartões).
- Marcos: mesclar o PR #36 e depois o #35 (nessa ordem), #37, #38 (depois de sair de rascunho), Lote 4 (ainda não preparado) e, por último, o Lote 1. Nenhum merge feito.
- Marcos: decidir o que entra no sitemap depois da correção (#39; 486 de 500 objetos são legado) e autorizar os PRs de #39 e #40.
- Marcos: conferir se a tabela `password_reset_tokens` existe no Supabase (sem DDL no repositório; a rota de redefinição devolve 500 sem ela) [N].
- Marcos: escolher as camadas da trava contra escrita em produção pelo servidor local (proposta §E do relatório; nada implementado).
- Cadeia de devolução ("Encontrei"): Fase 1 entregue, aguarda D1 (tensão decisão A × Manifesto 1 e 4) e D3–D13; D2 foi respondida em 08/10 (ver Decisões). Textos "sem retorno" e contato direto exigem revisão jurídica.
- M3 (limites por IP em magic-link, forgot-password, `/notify`, match e demais rotas públicas de e-mail): só listado, depois da 5a.
- Item à parte: `package-lock.json`/`.npmrc` (PR separado, ainda não iniciado).
- Fase final (só depois dos lotes): renomear a pasta antiga só após confirmar `resgate/15-commits-locais-2026-10-07` em de10e74; clone novo; nota datada no BACKFINDR.md.
- Mapa lento (/map, 12–15 s): não iniciado; medição de 25/09, registro de 25/09 não verificado hoje.
- 🔴 5 tokens do Meta em texto puro no workflow n8n `urluPuyxe4ccY9ZE`: revogação ADIADA por decisão do Marcos em 07/10/2026; não abrir detalhes desse workflow (regra do CLAUDE.md).
- AutoPost: execução 286 falhou em 07/10 03:00Z (ECONNRESET, [V: PAINEL-UNICO §5.3, 07/10]); conferir a rodada de 12/10 03:00 UTC.
- Workflow "Found Pending" (`hDJeRz5YpWi673u1`): `CRON_SECRET` de exemplo (falha com 401; registro de 01/10, não verificado hoje).
- PR #33 (PostHog sem e-mail/nome) e PR #34 (DECISOES.md) abertos, aguardam o Marcos; token R2 `backfindr-r2-manus` com permissão total (cartão no quadro).
- `FACEBOOK_APP_*` ausentes e ~10 variáveis sem uso na Vercel (registro de 01/10, não verificado hoje).
- ~~Tabela `municipalities` sem nenhum município de Rondônia~~ SUPERADO em 07/10/2026: `/achados-perdidos/porto-velho` responde 200 (DECISOES.md B-09); cobertura de RO = só a capital.
- ~~15 commits só existem em `~/Downloads/backfindr-local/backfindr-main`: decidir o que aproveitar~~ SUPERADO em 08/10/2026: publicados em `resgate/15-commits-locais-2026-10-07` (de10e74) e integrados por lotes (acima); o Google Ads fica só na branch de resgate (decisão do Marcos, 08/10).
- ~~Remetente de e-mail: verificar o domínio no Resend~~ SUPERADO em 08/10/2026: `backfindr.com.br` Verified e `backfindr.com` não cadastrado; 6 boas-vindas recusadas (403) em 15 dias (Resend, painel, Marcos, 08/10).
- ~~AutoPost: confirmar upload no R2 após a troca de token de 16/09~~ SUPERADO em 02/10/2026: execuções `success` em 22/09, 27/09 e 02/10 (API do n8n, 02/10; confirmado pelo Marcos). Em 07/10 uma execução falhou por rede (acima).
- ~~Projetos Railway abandonados `radiant-amazement` e `amusing-solace` falhando a cada push~~ SUPERADO em 01/10/2026: apagados por ordem do Marcos (BACKFINDR.md §18).
- BACKFINDR.md não registra a correção de 16/09 (token `backfindr-autopost-r2`) nem os PRs #30/#31 [V: grep em `origin/main` e em `integracao/lote-1-docs`, 09/10/2026: 0 ocorrências nos dois]; entra na nota de sessão do Lote 1.
Bloqueios / dependências externas:
- Decisão do Marcos sobre M2, teste real e merges (acima); o Code não executa nada real nem mescla sem isso.
- Acesso de leitura ao banco de produção: nenhum papel somente leitura configurado; por isso o estado do banco (caso "Barra forte", `password_reset_tokens`) está [N] para o Code.
- Logs de runtime da Vercel retêm ≈ 1 h (plano Hobby): não há como reconstruir e-mails ou cliques de dias atrás por esse caminho; o Resend guarda 15 dias.
- Revisão jurídica dos textos "sem retorno" e de contato direto.
- Tokens novos do Meta exigem login do Marcos no Business Manager (adiado).
Decisões recentes (com data):
- 09/10/2026: Lote 3 abre como PR rascunho, sem merge; sitemap e `/blog` viram itens separados (issues #39 e #40), sem implementar; branch descartável `integracao/teste-5a-mais-35` autorizada, nunca será mesclada; trava contra escrita em produção: só proposta; dado de terceiro em magic-link/forgot-password entra na 5a como commit separado (feito, 9b2455f); M2 e testes 1 a 3 aguardam o Marcos (Marcos, chat de 09/10/2026).
- 08/10/2026: integração por lotes com aprovação por lote; Lote 5a = M1 (escape) + M2 mínimo (limite por destinatário e por IP, sem migration; se não houver mecanismo, parar e propor); M3 (limites por IP nas demais rotas públicas de e-mail) como item separado; Lote 2 = GA4 + deduplicação em commit separado, Google Ads fora; Lote 3 preparado sem PR até o OK; Lote 1 publicado, mesclado só depois dos Lotes 2 a 4; ordem de merge registrada: 5a antes do #35 e Lote 1 por último; resgate preservado (Marcos, chat de 08/10/2026).
- 08/10/2026: autorização de testes com contas reais só para esta frente, só as duas contas indicadas pelo Marcos (a dele e a do achador do caso de referência; os endereços ficam fora do repositório público, no relatório e no chat) entre si; preview usa banco e Resend de produção, então cada teste só roda com o OK específico do Marcos, com registro do que foi gravado e restauração do estado; nenhum e-mail para os 6 usuários nem reenvio; nenhum merge, deploy ou migration (Marcos, chat de 08/10/2026).
- 08/10/2026: D2 respondida: `backfindr.com.br` Verified no Resend e `backfindr.com` não cadastrado; remetente padrão passa a `noreply@backfindr.com.br` no PR #35 (não mesclado) (Resend, Marcos, 08/10/2026).
- 08/10/2026: decisões A, B e C do fundador para a cadeia de devolução (achador se cadastra; implementar completo; "sem retorno" com revisão jurídica) tomadas no chat de 08/10/2026; texto proposto de registro no PR de documentação separado (docs/decisoes-integracao-08-09102026), sem tocar no PR #34.
- 07/10/2026: Manifesto = premissa protegida, discussão NÃO aberta; revogação dos tokens do Meta adiada; nenhum workflow n8n com tokens fixos é aberto sem aviso (Marcos, 07/10/2026).
- 01/10/2026: prioridade no portfólio = P1; projetos Railway abandonados apagados por ordem do Marcos (BACKFINDR.md §18).
- 25/09/2026: cofre de segredos (`~/bin/cofre`); segredos deste projeto só via cofre. 16/09/2026: um token R2 por consumidor. 30/08/2026: cadência do AutoPost a cada 5 dias.
