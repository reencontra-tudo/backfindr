# Governança de dados — anonimização (implementada e testada em banco descartável) e etapas seguintes (só desenho)

## Princípios
1. Dado inserido jamais some sem rastro: sai de uso → retenção por prazo → **anonimização**; toda movimentação é auditável.
2. Ao excluir, não se apaga tudo: anonimiza-se o que a LGPD exige e mantém-se a ocorrência de forma genérica e não identificável, para estatística.
3. Anonimização só vale se for **irreversível com meios razoáveis** (LGPD art. 12). **Este documento não afirma conformidade; há dúvidas para validação jurídica (final).**

## O que a anonimização mantém (lista FECHADA) e o que zera
Mantém: categoria/tipo, status, `is_legacy`, ano e **trimestre** de criação, **macro-região** (5 do IBGE; ou "Não informada"), resolvido sim/não, motivo de saída (`deleted_reason`).
Zera/generaliza: título (vira "Ocorrência anonimizada"), descrição e campos livres, localização, latitude/longitude, fotos (campo vira `[]`; arquivos vão para fila de remoção), QR e código (viram token que não resolve), placa, número de série, campos extras, recompensa, dados de terceiros/polícia, dono (vira a conta "anon"), horas (viram início do trimestre). Eventos ligados: só tipo e trimestre, sem ator nem texto. Matches: só score/status, sem usuário (o lado do outro usuário não é tocado).

## Quando roda
- **Fim da retenção** (90 dias, `audit.settings.retention_days`): rotina `audit.run_retention()` — **desligada por padrão** (`anonymize_enabled=false`).
- **Pedido de apagamento (LGPD): imediato** — admin "Anonimizar agora" (motivo obrigatório + caixa + palavra digitada) ou, para a conta inteira, rota `POST /api/v1/admin/users/[id]/anonymize` (só super_admin; sem tela ainda).
- Legado (`is_legacy`): **sempre recusado**; nenhuma linha legada é alterada nem entra na rotina.

## Ocorrência × conta
- **Excluir ocorrência:** lixeira (restaurável) → anonimiza a ocorrência. A conta continua.
- **Excluir conta (anonimizar usuário):** nome, e-mail, telefone, WhatsApp, avatar, vínculos de login, identificadores de pagamento, origem de acesso e senha são zerados; push, tokens de redefinição, de analytics e de link mágico são **removidos**; notificações e mensagens enviadas perdem o conteúdo; **todas as ocorrências não-legado** da conta são anonimizadas; o mapa `users.audit_ref` é **anulado** (a trilha deixa de se ligar à pessoa).

## Trilha (imutável, sem dado pessoal)
Só nomes de colunas alteradas + colunas estatísticas; ator e alvo como **referência pseudonimizada** (`users.audit_ref`); eventos `object_anonymized`/`user_anonymized`/`files_enqueued`/`files_removed` registram quem (referência), quando, motivo e contagens; arquivos removidos entram com **caminho e data**, nunca conteúdo.
Limite honesto: o `id` da ocorrência continua na trilha (e em URLs que sistemas externos podem ter registrado).

## Macro-região: como é derivada e com que precisão
1. UF escrita no fim do texto do local ("… - MA", "…, SP", "…/RJ") → macro-região da UF.
2. Senão, município mais próximo (entre os cadastrados em `municipalities`) **a até 300 km** → macro-região da UF dele.
3. Senão, "Não informada".
Medido no dump de 27/10 (ocorrências não-legado): ≈71% resolvidas pelo texto, ≈14% só por coordenadas, ≈16% "Não informada"; nos casos com texto **e** coordenadas os dois métodos concordaram em todos. A tabela de municípios é pequena (63 cidades): a maioria das coordenadas fica longe de qualquer uma, então o **texto é o método principal**. Melhoria possível: polígonos do IBGE (exige dado/extensão geográfica).
"193 vs 212": 212 = ocorrências **não-legado**; 193 = as que têm coordenadas (19 não têm; 4 têm só texto e 15 não têm nenhum dos dois). Os relatórios anteriores mediam por coordenadas.

## Risco de reidentificação (contagens agregadas)
Categoria × macro-região × trimestre (com "Não informada" como região): 19% dos casos novos e 23% de todos ficariam em células com menos de 5 casos; a função de estatística **junta** essas células em "outras" e **não publica** o que ainda ficar < 5. Mês, UF, município e coordenadas **não** são mantidos.

## Remoção de arquivos
O banco só enfileira caminhos (`audit.files_pending_removal`, sem conteúdo). O job `tools/gov-remove-pending-files.mjs` é **separado e desligado** (`GOV_FILE_REMOVAL_ENABLED=true` para ligar): remove do armazenamento e registra na trilha. Testado com armazenamento de teste; **adaptador do R2 não testado no R2 real; Supabase Storage ainda não suportado** (itens ficam `failed/nao_suportado`, nada é removido por engano).

## Etapa 5 — papel de aplicação sem permissão de apagar (só desenho)
`app_rw` (LOGIN, **BYPASSRLS** — as tabelas têm RLS ligado e sem políticas) com SELECT/INSERT/UPDATE; DELETE só em tabelas operacionais; **sem** DELETE/TRUNCATE/DDL em `objects`, `users`, `object_events`, `matches`; EXECUTE só em `audit.log_event` e (admin) nas funções de anonimização via papel próprio. `app_migrator` separado. Troca da variável de conexão primeiro em *preview*, depois produção; reversão = voltar a variável. Risco: rotas com DELETE legítimo não listadas; rotas `*/migrate*`.

## Etapa 4 — alerta no Telegram (só desenho)
Fonte: `audit.account_events` (`object_deleted`, `object_recovered`, `object_anonymized`) com `details.status ∈ {stolen, lost}`. Verificador a cada ~15 min com papel somente-leitura; mensagem agrupada **sem dado pessoal** (tipo, categoria, status anterior, motivo, quem: dono/admin/impersonação/sistema, hora, id curto). Falha do verificador avisa por outro canal. `shouldAlertOnChange` (`src/lib/governance.ts`) define quais status alertam.

## Dúvidas para o jurídico (nada aqui é parecer)
Base legal e prazo da retenção de 90 dias · anonimização vs eliminação (art. 12) e risco de reidentificação por combinação de região/trimestre/categoria · logs de acesso (Marco Civil) × trilha · política de privacidade e fluxo/prazo do pedido do titular · dados de terceiros em fotos e descrições · cópias fora do banco (PostHog, GA4, e-mails, posts, serviço de QR, backups com bloqueio de 30 dias) · registros fiscais ligados a pagamentos (`boosts`, assinaturas) que **não** são anonimizados por estas funções · denúncias (`reports`) e tentativas de contato (`signal_contact_attempts`) que mencionam a ocorrência · mensagens do outro lado de um chat.

## Impersonação
Início e fim gravados em `audit.account_events` com referência do administrador e do alvo; ações da sessão que passam por `withActor` recebem `actor_type = 'impersonacao'`. Escritas fora de `withActor` aparecem como `desconhecido` (cobertura cresce rota a rota).
