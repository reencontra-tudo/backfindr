# Rotação de segredos — checklist

## Por que este documento existe
Em 27/10/2026 o `CRON_SECRET` foi rotacionado na Vercel sem atualizar o header `Authorization` do nó HTTP Request de um workflow do n8n que chama uma rota protegida por ele. A rota respondeu 401 todos os dias de 28/10 a 03/11/2026 e ninguém foi avisado: sete dias de falha silenciosa. Nenhum dado se perdeu porque não havia itens pendentes, mas o lembrete deixou de rodar. A regra deste checklist: **trocar um segredo é trocar o valor em todos os lugares que o usam, e confirmar cada um.**

## Antes de rotacionar
1. Liste todos os consumidores do segredo (abaixo há a lista do `CRON_SECRET`; para outro segredo, procure por `process.env.<NOME>` em `src/` e confira os workflows do n8n e outros agendadores).
2. Decida a janela: as rotas protegidas falham fechadas (401) assim que o valor novo entra em produção; os chamadores externos só voltam a funcionar depois de atualizados.
3. Gere o valor novo fora do chat e dos arquivos versionados (por exemplo `openssl rand -hex 32`) e guarde no cofre de segredos antes de usar. Nunca cole o valor em issue, PR, log ou mensagem.

## Rotacionar
1. Atualize a variável na Vercel nos ambientes que a usam (Production e Preview têm valores independentes).
2. Atualize **cada chamador externo** da lista: no n8n, o header `Authorization: Bearer <valor>` do nó HTTP Request de cada workflow que chama a rota.
3. Faça o redeploy de produção para a variável valer.

## Depois de rotacionar (verificar, não presumir)
1. Chame cada rota consumidora com o valor novo e confirme 200; com um valor errado, confirme 401. Use rotas cuja chamada seja segura (sem efeito colateral relevante no momento) ou dispare a execução manual do workflow.
2. No n8n, dispare uma execução manual de cada workflow afetado e confirme sucesso.
3. No dia seguinte, confira que a execução agendada passou.
4. Registre a data da rotação e a lista de consumidores atualizados no registro de decisões do projeto, sem o valor.

## Consumidores do `CRON_SECRET` (rotas, conferido no código em 03/11/2026)
- `src/app/api/v1/cron/found-pending-reminders` (chamada diária pelo n8n)
- `src/app/api/v1/cron/matching`
- n8n «Backfindr Matching - Cron 15 min» (id `UHTA3WoSvRvi4Lsr`, ativo desde 16/11/2026): usa a credencial Bearer com o valor atual do segredo; troque-a junto com o `CRON_SECRET`.
- `src/app/api/v1/cron/lifecycle`
- `src/app/api/v1/cron/reactivation`
- `src/app/api/v1/cron/social-posts`
- `src/app/api/v1/emails/boost-expiration`
- `src/app/api/v1/admin/analytics/snapshot`
- `src/app/api/v1/admin/marketing/search/cron`
- `src/lib/cronAuth.ts` (verificação compartilhada)

Quem chama cada rota (n8n, Vercel Cron, outro agendador) deve ser confirmado na hora da rotação; esta lista cobre só quem **lê** o segredo.

## Segredos separados
`SIGNALS_CRON_SECRET` (ingestão de Public Signals) é um segredo distinto, de propósito, para poder ser revogado sem afetar o `CRON_SECRET`. Siga este mesmo checklist para ele.

## URLs de ping do Healthchecks (aviso de rotina que falha ou deixa de chegar)
Cada rotina agendada avisa o Healthchecks.io ao terminar, e o Healthchecks avisa o Marcos (Telegram e e-mail) quando o sinal falta ou quando chega «falha». As URLs de ping ficam em variáveis da Vercel (Production), uma por rotina:
- `HC_PING_MATCHING` (rota `cron/matching`, a cada 15 minutos);
- `HC_PING_FOUND_PENDING` (rota `cron/found-pending-reminders`, diária);
- `HC_PING_INGESTAO` (rota `admin/public-signals/ingest`, diária).

A URL de ping é um **semi-segredo**: quem a conhece pode forjar um sinal de vida. Não a cole em chat, issue, PR, log nem mensagem. Para trocar uma URL: gere o novo ping no Healthchecks, atualize a variável na Vercel e faça o redeploy; a URL antiga deixa de valer quando o check for recriado ou o ping for revogado. Sem a variável, a rotina não avisa o Healthchecks e funciona igual.

Rotina chamada com segredo errado (401) **não** envia ping: o silêncio é o que faz o Healthchecks avisar. Isso cobre o caso de segredo rotacionado sem atualizar o agendador.

## Complemento possível (não implementado)
Um Error Workflow do n8n, que avise quando um fluxo falhar dentro do próprio n8n. O Healthchecks já cobre a falha e o silêncio de fora do Backfindr.
