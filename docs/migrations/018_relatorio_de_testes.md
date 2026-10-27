# Migração 018 — relatório de testes (banco descartável)

Ambiente: PostgreSQL 17 (Docker) restaurado de um dump recente do banco (≈2,2 mil `objects`, dos quais 2.002 legado; ≈4,4 mil `users`). Nada foi aplicado em produção.

## 1. Ciclo da migração (`tests/run_018.sh`)
| Verificação | Resultado |
|---|---|
| Aplicar | ≈0,25 s no total (inclui o `docker exec`) |
| Linhas alteradas ao aplicar | nenhuma (contagens e checksums de objects/users/events/matches iguais) |
| Reescrita de tabela | nenhuma (`relfilenode` igual → coluna nula = só metadado) |
| Reverter | banco idêntico ao inicial (contagens, checksums, `relfilenode`); trilha arquivada, não apagada |
| Reaplicar | sem erro (idempotente) |
| Reversão com linhas na lixeira | aborta sem alterar nada |

## 2. Testes SQL (`tests/018_testes.sql`) — 15/15 OK
T0 legado 100% visível na visão · T1 exclusão lógica com os 13 motivos (auditoria com ator, origem e requisição; oculta na visão; mantida na base) · T1b motivo fora da lista e texto > 200 rejeitados · T2 `DELETE` direto (caminho antigo) e cascata (eventos e matches) auditados · T3 `DELETE` de usuário auditado com a cascata · T4 restauração devolve a ocorrência idêntica · T5 "marcar como recuperado" auditado · T6 pausar/reativar · T7 duplicata (consulta de parecidas, manter uma) · T8 trilha imutável (UPDATE/DELETE/TRUNCATE bloqueados) · T9 auditoria com defeito não derruba a operação · T10 sem ator/ator inválido → `desconhecido` · T11 redação de senha e dados pessoais · T12 limpeza definitiva: desligada não age, *dry-run* só conta, ligada remove só não-legado vencido e registra · T13 eventos de impersonação e permissões.

## 3. Testes unitários (`tests/governance.test.mjs`, `node --test`) — 12/12 OK
Regras de motivo (dono opcional, admin obrigatório, texto limitado), passos do modal por motivo, retenção, ator (usuário/admin/impersonação), alinhamento dos códigos com o `CHECK` da migração.

## 4. Ponta a ponta nas rotas reais (`tests/e2e/governanca_rotas.py`) — 44/44 OK
Servidor de desenvolvimento apontado para o banco descartável: exclusão do dono com motivo e "Desfazer", validações, pausar/reativar, recuperado, duplicatas, QR/scan de ocorrência excluída (404), exclusão do admin com motivo obrigatório, lixeira e restauração, e impersonação (início/fim registrados; ações com `actor_type = impersonacao`). Nenhuma exclusão física foi feita pelas rotas.

## 5. Consultas alteradas (leituras → `objects_active`)
118 trocas em 47 arquivos: 84 consultas estáticas validadas com `PREPARE` no banco descartável (nenhum erro novo); 25 dinâmicas revisadas por diff; varredura de 13 rotas de leitura sem erro novo. Checagem de tipos (`tsc`): nenhum erro novo.

## 6. Custo medido
| Operação | Com auditoria | Sem |
|---|---|---|
| `UPDATE` de 1 linha (média de 200) | ≈2,45 ms | ≈1,13 ms |
| `UPDATE` de 2.214 linhas | ≈2,2 s | ≈0,7 s |
| Plano de leitura pela visão vs. tabela | mesmo plano, mais um filtro `deleted_at IS NULL` | — |
