# Migração 018 — relatório de testes (banco descartável)

Ambiente: PostgreSQL 17 (Docker) restaurado de dump recente do banco (≈2,2 mil `objects`, 2.002 legado; ≈4,4 mil `users`). Nada foi aplicado em produção.

## 1. Ciclo da migração (`tests/run_018.sh`)
| Verificação | Resultado |
|---|---|
| Aplicar | ≈0,5 s no total (inclui o `docker exec` e o preenchimento de `users.audit_ref`) |
| Linhas alteradas | nenhuma ocorrência, usuário, evento ou match (contagens e checksums iguais; a conta "anon" é a única linha nova) |
| Reescrita de tabela | `objects` não é reescrita (`relfilenode` igual); `users` é reescrita uma vez (backfill de `audit_ref`) |
| Reverter | banco idêntico ao inicial (contagens, checksums, `relfilenode` de `objects`); trilha **arquivada**, não apagada (mesmas linhas e eventos) |
| Reverter com ocorrência já anonimizada | colunas de governança mantidas; linha continua anonimizada; trilha preservada |
| Reaplicar | sem erro (idempotente; reaplicar após reversão deixa a conta "anon" inerte) |
| Reversão com linhas na lixeira não anonimizadas | aborta sem alterar nada |

## 2. Testes SQL (`tests/018_testes.sql`) — todos OK
**Governança (T0–T13):** legado 100% visível · exclusão lógica com os 13 motivos · motivos/tamanho/anonimização inválidos rejeitados · DELETE direto e cascata auditados **sem conteúdo** · DELETE de usuário (trilha usa a referência, não o id) · restauração idêntica · recuperado · pausar/reativar · duplicata · trilha imutável (UPDATE/DELETE/TRUNCATE) · falha da auditoria não derruba a operação · ator desconhecido · `users` sem senha/e-mail/nome/id na trilha · eventos de impersonação e permissões.
**Trilha sem conteúdo (R1):** 19 trechos únicos (nome, e-mail, telefone, título, descrição, endereço, coordenadas, QR, foto, placa, série, chassi, texto de evento, texto livre) = 0 ocorrências nas duas tabelas da trilha.
**Anonimização (A1–A10):** nenhuma coluna identificadora com valor (varredura por coluna) · contagens por categoria/status/legado/ano/trimestre/resolvido (objetos), tipo/ano/trimestre (eventos) e score/status/trimestre (matches) **idênticas antes e depois** · trilha sem o conteúdo anonimizado e evento `object_anonymized` com ator pseudonimizado · fila de arquivos (caminhos sem host/query; base64 descartado) · idempotência · **legado recusado** (e motivo inválido → erro) · anonimizar conta (dados pessoais, credenciais, notificações e mensagens; **`audit_ref` anulado**; ocorrências anonimizadas) · conta "anon" sem login possível · rotina de retenção (**purga não existe**; desligada não age; *dry-run* só conta; ligada anonimiza o vencido, não toca legado, registra a execução).
**Estatística (S1)** com mínimo de 5 por célula e **macro-região (M1)**.

## 3. Testes unitários (`tests/governance.test.mjs`, `node --test`) — 15/15 OK
Regras de motivo (dono opcional, admin obrigatório, texto limitado), passos do modal, retenção, ator, anonimização (motivo + confirmação digitada), texto da retenção ("anonimizada, não apagada"), alinhamento dos códigos com os `CHECK` da migração.

## 4. Ponta a ponta nas rotas reais (`tests/e2e/governanca_rotas.py`) — 68/68 OK
Servidor de desenvolvimento apontado para o banco descartável: exclusão do dono com motivo e "Desfazer", validações, pausar/reativar, recuperado, duplicatas, QR/scan de excluída (404), exclusão do admin com motivo obrigatório, Lixeira e restauração, impersonação (início/fim; ações com `actor_type = impersonacao`), **anonimização pelo admin** (motivo + confirmação digitada; recusa legado; idempotente; restauração bloqueada), **anonimização de conta** (só super_admin), **login da conta anon e da conta anonimizada = 401**, e **job de remoção de arquivos** (desligado por padrão; ligado em armazenamento de teste remove o arquivo e registra caminho e data, sem conteúdo).

## 5. Consultas alteradas (leituras → `objects_active`)
118 trocas em 47 arquivos: 84 estáticas validadas com `PREPARE` (nenhum erro novo); 25 dinâmicas revisadas por diff; varredura de rotas de leitura sem erro novo. `tsc`: nenhum erro novo.

## 6. Custo medido
| Operação | Com auditoria | Sem |
|---|---|---|
| `UPDATE` de 1 linha | ≈2,5 ms | ≈1,1 ms |
| `UPDATE` de 2.214 linhas | ≈2,2 s | ≈0,7 s |
| Plano de leitura pela visão | mesmo plano + filtro `deleted_at IS NULL` | — |

## 7. Não testado
Remoção real no R2/Supabase Storage (só armazenamento de teste); desempenho com volume de produção ao longo de meses; PostHog/GA4/e-mails/posts (fora do banco); retenção dos backups.
