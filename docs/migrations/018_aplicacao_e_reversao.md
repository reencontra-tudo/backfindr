# Migração 018 — aplicar e reverter (governança de dados)

Status: **construída e testada em banco descartável; NÃO aplicada em produção.** Só aplicar com ordem escrita do responsável.
Arquivos: `018_governanca_auditoria_exclusao_logica.sql` (aplicar) · `018_governanca_auditoria_exclusao_logica_reversao.sql` (reverter) · `tests/` (testes).

## O que muda
- schema `audit` (trilha somente-inserção: `row_changes`, `account_events`, `settings`) e gatilhos em `objects`, `users`, `object_events`, `matches`;
- colunas **nulas** `deleted_at, deleted_by, deleted_reason, deleted_reason_text` em `objects` e `users`, e `paused_at` em `objects`;
- visões `objects_active` / `users_active` (sem excluídos; `security_invoker`; sem acesso para `anon`/`authenticated`);
- `audit.purge_deleted()`: limpeza definitiva **desligada** (`audit.settings.purge_enabled = 'false'`), nunca remove legado (`is_legacy`).
Nenhuma linha existente é alterada. Medido no banco descartável (≈2,2 mil objects, ≈4,4 mil users): aplicação em ≈0,25 s, sem reescrita de tabela, contagens e checksums idênticos antes/depois.

## Ordem OBRIGATÓRIA
1. **Migração primeiro, código depois.** O código novo lê `objects_active` e usa as colunas novas; sem a migração ele falha. A migração é compatível com o código antigo (só adiciona).
2. Reverter na ordem inversa: **código primeiro, migração depois.**

## Passo a passo para APLICAR
1. Conferir o backup do dia (R2) e que o teste de restore mensal está verde. Anotar o horário.
2. Escolher horário de baixo tráfego. Não há janela de manutenção: os bloqueios duram milissegundos (a migração roda numa transação com `lock_timeout = 5s`; se não conseguir o bloqueio, aborta sem aplicar nada).
3. Rodar com a URL **de sessão (porta 5432) do papel dono**, lida do cofre, sem exibir o valor:
   ```bash
   PGURL="$(~/bin/cofre pipe supabase-backfindr-database-url | sed 's#:6543/#:5432/#')"
   psql "$PGURL" -X -v ON_ERROR_STOP=1 -f docs/migrations/018_governanca_auditoria_exclusao_logica.sql
   unset PGURL
   ```
4. Verificar (somente leitura):
   ```sql
   select count(*) from public.objects_active;            -- igual a select count(*) from public.objects
   select count(*) from audit.row_changes;                 -- 0 logo após aplicar
   select key, value from audit.settings;                  -- retention_days=90, purge_enabled=false
   select has_table_privilege('anon','public.objects_active','select');   -- false
   ```
5. Só então fazer o merge do PR do código e esperar o deploy (Vercel). Fumaça: abrir uma ocorrência de teste própria, excluir (modal), desfazer, pausar/reativar, abrir a Lixeira no admin; conferir `audit.row_changes` e `audit.account_events`.
6. Acompanhar logs por 24 h (erros "relation objects_active does not exist" indicam migração não aplicada).
7. **Não** ligar a limpeza definitiva. Ela só roda se `purge_enabled = 'true'` **e** alguém chamar `audit.purge_deleted(false)`.

## Passo a passo para REVERTER
1. Reverter o código (revert do PR e novo deploy) — o app volta a ler `objects`/`users`.
2. Verificar a lixeira: a reversão **aborta** se houver linhas com `deleted_at`. Restaure-as pelo admin (Lixeira → Restaurar) ou decida o destino.
3. Rodar `018_governanca_auditoria_exclusao_logica_reversao.sql` (mesma forma do passo 3 acima). Ele remove gatilhos, visões e colunas aditivas e **renomeia** o schema `audit` para `audit_arquivada_AAAAMMDD_HHMMSS` — **a trilha nunca é apagada**.
4. Verificar que `objects`/`users` têm as mesmas contagens de antes.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Código implantado antes da migração | Ordem obrigatória; migração aditiva; checagem do passo 4 |
| Bloqueio por transação longa concorrente | `lock_timeout = 5s` aborta sem efeito; repetir em outro horário |
| Esquecer de filtrar excluídos em alguma leitura nova | Leituras usam `objects_active`; teste e revisão de PR |
| Gatilhos de auditoria deixam escritas mais lentas | Medido +≈1,3 ms por UPDATE; em massa (2,2 mil linhas) ≈3× (rara) |
| Crescimento da trilha | Pequeno hoje; monitorar tamanho; política de arquivamento depois |
| Auditoria com defeito | Gatilho nunca derruba a operação (aviso no log); coberto em teste |
| Texto livre do motivo com dado pessoal | Limite de 200 caracteres; tratado como dado; fora da trilha de eventos |
| Segredos/dados pessoais nas cópias auditadas | Redação automática (senha/tokens → `[redigido]`; nome/e-mail/telefone de `users` → `[pessoal]`) |
| Legado | Nenhuma linha legada é alterada, ocultada nem elegível à limpeza (`is_legacy`) |
