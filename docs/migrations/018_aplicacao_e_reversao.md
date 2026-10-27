# Migração 018 — aplicar e reverter (governança de dados com anonimização)

Status: **construída e testada em banco descartável; NÃO aplicada em produção.** Só aplicar com ordem escrita do responsável.
Arquivos: `018_governanca_auditoria_exclusao_logica.sql` (aplicar) · `018_governanca_auditoria_exclusao_logica_reversao.sql` (reverter) · `tests/` (testes) · `tools/gov-remove-pending-files.mjs` (job de remoção de arquivos, desligado).

## O que muda
- **Trilha de auditoria somente-inserção** (`audit.*`): guarda só **nomes das colunas alteradas** e **colunas estatísticas** (categoria, status, ano, trimestre, macro-região…). Nenhum título, descrição, endereço, coordenada, foto, QR, placa, número de série, e-mail, nome, telefone ou id de usuário. O ator é uma **referência aleatória** (`users.audit_ref`); ao anonimizar o usuário o mapa é anulado e a trilha deixa de se ligar à pessoa.
- **Exclusão lógica com motivo** (lixeira, retenção de 90 dias, configurável em `audit.settings`) → ao fim do prazo, **anonimização** (não apagamento).
- **Anonimização** (`audit.anonymize_object`, `audit.anonymize_user`): mantém só categoria/tipo, status, `is_legacy`, ano e trimestre, macro-região, resolvido sim/não e motivo de saída; o restante é zerado/generalizado; fotos entram numa **fila de remoção** (caminho e data, sem conteúdo); a ocorrência passa para a **conta "anon"** (sistema, sem login). **Recusa legado.** Idempotente.
- **Rotina de fim de retenção** `audit.run_retention()`: **desligada** (`anonymize_enabled=false`). **Não existe purga definitiva.**
- **Estatística** `public.estatistica_ocorrencias()`: categoria × macro-região × trimestre; células com menos de 5 casos são juntadas em "outras" e, se ainda < 5, não são publicadas.
- Visões `objects_active` / `users_active` (sem excluídos; `security_invoker`; sem acesso para `anon`/`authenticated`).

### Efeitos sobre dados existentes (únicos)
1. `users.audit_ref` recebe um id aleatório por usuário (preenchimento único; **reescreve a tabela `users`**, ≈4,4 mil linhas, ≈0,5 s no total da migração).
2. É criada **uma** conta de sistema inerte "anon". Nenhuma ocorrência, evento ou match existente é alterado (contagens e checksums idênticos antes/depois, medido).

## Ordem OBRIGATÓRIA
1. **Migração primeiro, código depois.** O código novo lê `objects_active` e usa as colunas novas; sem a migração falha. A migração é compatível com o código antigo (só adiciona).
2. Reverter na ordem inversa: **código primeiro, migração depois.**
3. **Antes de aplicar em produção:** esta versão da trilha já nasce sem conteúdo identificador; **não aplicar uma versão anterior** da 018 (a trilha é imutável: o que for gravado não se corrige).

## Passo a passo para APLICAR
1. Conferir o backup do dia (R2) e que o teste de restore mensal está verde. Anotar o horário.
2. Horário de baixo tráfego. Não há janela de manutenção: bloqueios de milissegundos; a migração roda numa transação com `lock_timeout = 5s` (se não conseguir o bloqueio, aborta sem aplicar nada).
3. Rodar com a URL **de sessão (porta 5432) do papel dono**, lida do cofre, sem exibir o valor:
   ```bash
   PGURL="$(~/bin/cofre pipe supabase-backfindr-database-url | sed 's#:6543/#:5432/#')"
   psql "$PGURL" -X -v ON_ERROR_STOP=1 -f docs/migrations/018_governanca_auditoria_exclusao_logica.sql
   unset PGURL
   ```
4. Verificar (somente leitura):
   ```sql
   select count(*) from public.objects_active;      -- igual a select count(*) from public.objects
   select count(*) from audit.row_changes;           -- 0 logo após aplicar
   select key, value from audit.settings;            -- retention_days=90, anonymize_enabled=false, file_removal_enabled=false, stats_min_cell=5
   select count(*) from public.users where audit_ref is null and anonymized_at is null;   -- 0
   select has_table_privilege('anon','public.objects_active','select');                    -- false
   ```
5. Só então mesclar o PR do código e esperar o deploy. Fumaça: ocorrência de teste própria → excluir (modal), desfazer, pausar/reativar; Lixeira no admin; conferir `audit.row_changes` e `audit.account_events` (sem conteúdo identificador).
6. Acompanhar os logs por 24 h (erro "relation objects_active does not exist" = migração não aplicada).
7. **Não ligar** `anonymize_enabled` nem `file_removal_enabled` sem decisão. A rotina `audit.run_retention(false)` e o job de arquivos só agem se ligados.

## Passo a passo para REVERTER
1. Reverter o código (revert do PR e novo deploy).
2. A reversão **aborta** se houver linhas na lixeira ainda não anonimizadas: restaure-as (Lixeira → Restaurar) ou anonimize-as antes.
3. Rodar `018_..._reversao.sql`. Remove gatilhos, visões e funções; **renomeia** o schema `audit` para `audit_arquivada_AAAAMMDD_HHMMSS` (**a trilha nunca é apagada**) e copia o mapa usuário→referência para `audit.actor_map_snapshot` (acesso restrito) antes de tirar `users.audit_ref`.
4. **Anonimização é irreversível:** se já houver linhas anonimizadas, as colunas de governança são **mantidas** (aviso no log) e a conta "anon" permanece, para o registro não se perder.
5. Verificar contagens de `objects`/`users`.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Código antes da migração | Ordem obrigatória; migração só adiciona |
| Aplicar versão antiga da 018 (trilha com conteúdo) | Só esta versão; a trilha é imutável — conferir o arquivo antes |
| `users` reescrita (≈4,4 mil linhas) | Transação com `lock_timeout`; ≈0,5 s medido; backup antes |
| Esquecer o filtro de excluídos em leitura nova | Leituras usam `objects_active`; teste e revisão |
| Anonimização irreversível acionada por engano | Admin: motivo + caixa + palavra digitada; rota exige confirmação; rotina automática desligada |
| Arquivos (fotos) continuam no armazenamento | Fila + job separado, desligado; adaptador R2 **não testado** no R2 real; Supabase Storage não suportado ainda |
| Dado em sistemas fora do banco (PostHog, GA4, e-mails, posts, serviço de QR, backups de 30 dias) | Fora do alcance técnico; lista para o jurídico |
| Macro-região imprecisa (texto sem UF e coordenadas longe dos 63 municípios cadastrados) | "Não informada"; precisão medida (ver desenho) |
| Reidentificação por combinação rara | Só macro-região + trimestre; estatística com mínimo de 5 |
| Legado | Recusado pela função, excluído da rotina, nenhuma linha legada é alterada |
