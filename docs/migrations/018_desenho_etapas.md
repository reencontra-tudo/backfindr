# Governança de dados — desenho das etapas seguintes (NADA implementado aqui)

As etapas 0, 1 e 2 estão construídas e testadas (migração 018). Abaixo, apenas o desenho das etapas 5, 4 e 3, para decisão.

## Etapa 5 — papel de aplicação sem permissão de apagar
Objetivo: mesmo com um bug ou credencial vazada, o app não consegue `DELETE`/`TRUNCATE`/DDL em tabelas de negócio.
- Criar o papel `app_rw` (LOGIN, **BYPASSRLS** — as tabelas têm RLS ligado e sem políticas, hoje o app só funciona porque conecta como dono) com: `SELECT/INSERT/UPDATE` nas tabelas; `DELETE` **somente** numa lista explícita de tabelas operacionais (notificações, assinaturas push, tokens de redefinição, controle de envio…); **sem** `DELETE`/`TRUNCATE` em `objects`, `users`, `object_events`, `matches`; sem DDL; `EXECUTE` apenas em `audit.log_event`.
- Papel separado `app_migrator` (dono das migrações) fora do runtime do app; as rotas `*/migrate*` que criam tabelas passam a usá-lo ou a ser desligadas.
- Segredo novo no cofre; troca da variável de conexão na Vercel primeiro em *preview*, depois produção; monitorar erros `permission denied` (indicam rotas que ainda apagam ou alteram estrutura).
- Reversão: voltar a variável de conexão ao papel anterior (nada no banco precisa ser desfeito).
- Riscos: rotas com `DELETE` legítimo não listadas; rotinas de migração; nome de usuário no pooler (`app_rw.<ref>`).

## Etapa 4 — alerta no Telegram (ocorrência de roubo, furto ou perda excluída ou marcada como recuperada)
- Fonte: `audit.account_events` (`object_deleted`, `object_recovered`) com `details.status ∈ {stolen, lost}`; opcionalmente `audit.row_changes` para mudanças de status.
- Leitura por papel **somente leitura**; um verificador a cada ~15 min (rotina do vigia ou workflow agendado) lê eventos novos desde o último id processado (guardado em cache/variável) e envia **uma mensagem agrupada**.
- Conteúdo, sem dado pessoal: tipo de evento, categoria, status anterior, motivo (código), autor (dono/admin/impersonação), hora, id curto. Ex.: "🔔 Ocorrência de roubo excluída pelo dono · motivo: desisti · há 3 min · #ab12cd34".
- Falha do verificador avisa por outro canal (Healthchecks). Desligar: variável de ambiente do verificador; a trilha continua gravando.
- A regra `shouldAlertOnChange` (em `src/lib/governance.ts`) já define quais status alertam.

## Etapa 3 — LGPD (precisa de validação jurídica antes de qualquer implementação)
- Pedido de exclusão de dados: registra `account_delete_request`, marca a conta como excluída (`users.deleted_at`, motivo `pedido_lgpd`) e a oculta/bloqueia durante a retenção.
- Após o prazo: **anonimizar** em vez de apagar a linha (nome, e-mail, telefone, WhatsApp, avatar, vínculos de login e senha); a auditoria guarda só ids (já redige dados pessoais), portanto não retém dado pessoal.
- Ocorrências do titular: decidir se são anonimizadas, mantidas por interesse público/segurança ou removidas; textos livres podem conter dados de terceiros.
- Backups: o bucket tem bloqueio de 30 dias; o pedido só alcança os backups depois do prazo — informar ao titular.
- Pontos para o jurídico: base legal, prazos (inclusive fiscais para registros de cobrança), direito de acesso/portabilidade (hoje "em breve"), menores, comunicação ao titular.

## Impersonação (resumo do que já está na branch)
- Início e fim gravados em `audit.account_events` com o id do administrador e o do alvo; todas as ações dessa sessão que passam por `withActor` recebem `actor_type = 'impersonacao'` (ator = administrador, alvo registrado). Escritas fora de `withActor` aparecem como `desconhecido` (cobertura crescente, ver `src/lib/audit.ts`).
