-- LIMPEZA DOS DADOS DE TESTE do Programa de Colaboradores (modo teste). ENSAIADA em banco descartável; NUNCA executada em produção.
--
-- ATENÇÃO — NÃO EXECUTAR sem ordem expressa do fundador. O script termina em ROLLBACK de propósito: para valer, troque a ÚLTIMA linha por COMMIT, só com ordem.
-- Rodar com `psql` (os comandos \copy do passo 1 não existem no console do Supabase nem em chamadas de SQL por API).
--
-- QUANDO: só se NÃO existir colaborador real nem pagamento real (as guardas do passo 0 abortam tudo se existir). Se existir algo real, NÃO use este script: aposentar (opção 2 da decisão PC-16).
-- PRÉ-REQUISITOS: (1) backup do dia conferido pelo NAV; (2) exportação do passo 1 guardada junto do backup; (3) jurídico avisado (guarda do livro por 5 anos, PC-06).
-- CONVENÇÃO DE TESTE: @nome começando com `teste-`; e-mail do usuário com `+teste`; título da ocorrência com `[TESTE]`.
-- O QUE ELE FAZ: desliga os 5 gatilhos de imutabilidade, apaga SÓ o que pertence ao teste, religa os gatilhos, confere e (só com COMMIT) grava. Tudo numa transação:
--   qualquer erro desfaz tudo, inclusive o desligamento dos gatilhos (DDL é transacional no Postgres).
-- O QUE NÃO TOCA: colaborador interno (@backfindr) e tudo dele; usuários e ocorrências reais; eventos de pagamento de outros pagamentos; `programa_config` (regras: se mudaram para o teste, voltar por fora, com nova vigência).
-- DEPOIS DE APAGAR: não reenviar notificações do Mercado Pago dos pagamentos de teste (ver análise na decisão PC-16).
-- Reversão: ROLLBACK antes do COMMIT; depois do COMMIT, só restaurando o backup (e a exportação do passo 1).

\set ON_ERROR_STOP on

BEGIN;

-- ── 0. Alvos e GUARDAS ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE alvo_colab ON COMMIT DROP AS SELECT id FROM colaboradores WHERE slug LIKE 'teste-%' AND NOT interno;
CREATE TEMP TABLE alvo_users ON COMMIT DROP AS SELECT id FROM users WHERE email ILIKE '%+teste%';
CREATE TEMP TABLE alvo_pagto ON COMMIT DROP AS
  SELECT provider_ref AS ref FROM boosts WHERE provider = 'mercadopago' AND provider_ref IS NOT NULL
     AND (user_id IN (SELECT id FROM alvo_users) OR object_id IN (SELECT id FROM objects WHERE colaborador_id IN (SELECT id FROM alvo_colab)))
  UNION SELECT pagamento_ref FROM colaborador_lancamentos WHERE colaborador_id IN (SELECT id FROM alvo_colab) AND pagamento_ref IS NOT NULL;
CREATE TEMP TABLE alvo_ids_texto ON COMMIT DROP AS
  SELECT id::text AS id FROM alvo_colab
  UNION SELECT id::text FROM colaborador_verificacoes WHERE colaborador_id IN (SELECT id FROM alvo_colab)
  UNION SELECT id::text FROM colaborador_saques WHERE colaborador_id IN (SELECT id FROM alvo_colab)
  UNION SELECT id::text FROM colaborador_sinais WHERE colaborador_id IN (SELECT id FROM alvo_colab);

DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM colaboradores WHERE NOT interno AND slug NOT LIKE 'teste-%';
  IF n > 0 THEN RAISE EXCEPTION 'ABORTADO: existem % colaborador(es) REAL (fora do padrão teste-). Use a opção 2 (aposentar).', n; END IF;
  SELECT count(*) INTO n FROM colaborador_lancamentos WHERE colaborador_id NOT IN (SELECT id FROM alvo_colab);
  IF n > 0 THEN RAISE EXCEPTION 'ABORTADO: o livro tem % lançamento(s) que NÃO são de colaborador de teste.', n; END IF;
  SELECT count(*) INTO n FROM colaborador_saques WHERE colaborador_id NOT IN (SELECT id FROM alvo_colab);
  IF n > 0 THEN RAISE EXCEPTION 'ABORTADO: existem % saque(s) que NÃO são de colaborador de teste.', n; END IF;
  SELECT count(*) INTO n FROM colaborador_sinais WHERE colaborador_id NOT IN (SELECT id FROM alvo_colab);
  IF n > 0 THEN RAISE EXCEPTION 'ABORTADO: existem % sinal(is) que NÃO são de colaborador de teste.', n; END IF;
  SELECT count(*) INTO n FROM colaborador_dados_pagamento WHERE colaborador_id NOT IN (SELECT id FROM alvo_colab);
  IF n > 0 THEN RAISE EXCEPTION 'ABORTADO: existem % dado(s) de pagamento que NÃO são de colaborador de teste.', n; END IF;
END $$;

\echo '== CONTAGENS ANTES (só do que é teste)'
SELECT 'colaboradores de teste' AS item, count(*) AS n FROM alvo_colab
UNION ALL SELECT 'usuários de teste', count(*) FROM alvo_users
UNION ALL SELECT 'ocorrências de teste (do usuário de teste ou com código de teste)', count(*) FROM objects WHERE user_id IN (SELECT id FROM alvo_users) OR colaborador_id IN (SELECT id FROM alvo_colab)
UNION ALL SELECT 'boosts de teste', count(*) FROM boosts WHERE provider_ref IN (SELECT ref FROM alvo_pagto) OR user_id IN (SELECT id FROM alvo_users)
UNION ALL SELECT 'eventos de pagamento de teste', count(*) FROM pagamento_eventos WHERE pagamento_id IN (SELECT ref FROM alvo_pagto)
UNION ALL SELECT 'livro (lançamentos)', count(*) FROM colaborador_lancamentos
UNION ALL SELECT 'sinais', count(*) FROM colaborador_sinais
UNION ALL SELECT 'visitas (linhas)', count(*) FROM colaborador_visitas_dia WHERE colaborador_id IN (SELECT id FROM alvo_colab)
UNION ALL SELECT 'verificações', count(*) FROM colaborador_verificacoes WHERE colaborador_id IN (SELECT id FROM alvo_colab)
UNION ALL SELECT 'dados de pagamento', count(*) FROM colaborador_dados_pagamento
UNION ALL SELECT 'saques', count(*) FROM colaborador_saques
UNION ALL SELECT 'aceites da política', count(*) FROM politica_aceites WHERE user_id IN (SELECT id FROM alvo_users)
UNION ALL SELECT 'auditoria (do teste)', count(*) FROM auditoria WHERE alvo_id IN (SELECT id FROM alvo_ids_texto) OR ator_id IN (SELECT id FROM alvo_users);

-- ── 1. EXPORTAÇÃO PRÉVIA (vai para o backup, ANTES de apagar). Chaves PIX e documentos saem CIFRADOS, como estão no banco. ─────────────────
\echo '== EXPORTAÇÃO PRÉVIA para /tmp/exportacao-teste (crie a pasta antes e troque o caminho abaixo se precisar)'
\copy (SELECT * FROM colaborador_lancamentos ORDER BY criado_em) TO '/tmp/exportacao-teste/livro.csv' CSV HEADER
\copy (SELECT * FROM auditoria WHERE alvo_id IN (SELECT id FROM alvo_ids_texto) OR ator_id IN (SELECT id FROM alvo_users) ORDER BY criado_em) TO '/tmp/exportacao-teste/auditoria.csv' CSV HEADER
\copy (SELECT * FROM colaborador_sinais ORDER BY criado_em) TO '/tmp/exportacao-teste/sinais.csv' CSV HEADER
\copy (SELECT * FROM pagamento_eventos WHERE pagamento_id IN (SELECT ref FROM alvo_pagto) ORDER BY recebido_em) TO '/tmp/exportacao-teste/eventos.csv' CSV HEADER
\copy (SELECT * FROM colaborador_saques ORDER BY solicitado_em) TO '/tmp/exportacao-teste/saques.csv' CSV HEADER
\copy (SELECT * FROM colaborador_dados_pagamento) TO '/tmp/exportacao-teste/dados_pagamento.csv' CSV HEADER
\copy (SELECT * FROM colaborador_verificacoes WHERE colaborador_id IN (SELECT id FROM alvo_colab)) TO '/tmp/exportacao-teste/verificacoes.csv' CSV HEADER
\copy (SELECT * FROM colaborador_visitas_dia WHERE colaborador_id IN (SELECT id FROM alvo_colab)) TO '/tmp/exportacao-teste/visitas.csv' CSV HEADER
\copy (SELECT * FROM colaboradores WHERE id IN (SELECT id FROM alvo_colab)) TO '/tmp/exportacao-teste/colaboradores.csv' CSV HEADER
\copy (SELECT * FROM boosts WHERE provider_ref IN (SELECT ref FROM alvo_pagto) OR user_id IN (SELECT id FROM alvo_users)) TO '/tmp/exportacao-teste/boosts.csv' CSV HEADER
-- CONFERÊNCIA: cada arquivo deve ter (contagem acima + 1 linha de cabeçalho). Só siga se bater.

-- ── 2. DESLIGAR os 5 gatilhos (precisa ser DONO das tabelas) ─────────────────────────────────────────────────────────
ALTER TABLE colaborador_lancamentos DISABLE TRIGGER trg_colaborador_lancamentos_imutavel;
ALTER TABLE colaborador_lancamentos DISABLE TRIGGER trg_colaborador_lancamentos_sem_truncate;
ALTER TABLE auditoria DISABLE TRIGGER trg_auditoria_imutavel;
ALTER TABLE auditoria DISABLE TRIGGER trg_auditoria_sem_truncate;
ALTER TABLE colaboradores DISABLE TRIGGER trg_colaboradores_sem_delete;

-- ── 3. APAGAR, na ordem das dependências, SÓ o que é de teste ─────────────────────────────────────────────────────────
DELETE FROM auditoria WHERE alvo_id IN (SELECT id FROM alvo_ids_texto) OR ator_id IN (SELECT id FROM alvo_users);
DELETE FROM colaborador_saques WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM colaborador_dados_pagamento WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM colaborador_verificacoes WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM colaborador_sinais WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM colaborador_visitas_dia WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM colaborador_lancamentos WHERE colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM pagamento_eventos WHERE pagamento_id IN (SELECT ref FROM alvo_pagto);
DELETE FROM boosts WHERE provider_ref IN (SELECT ref FROM alvo_pagto) OR user_id IN (SELECT id FROM alvo_users);
DELETE FROM objects WHERE user_id IN (SELECT id FROM alvo_users) OR colaborador_id IN (SELECT id FROM alvo_colab);
DELETE FROM politica_aceites WHERE user_id IN (SELECT id FROM alvo_users);
DELETE FROM colaboradores WHERE id IN (SELECT id FROM alvo_colab);
DELETE FROM users WHERE id IN (SELECT id FROM alvo_users);   -- se alguma tabela real ainda apontar para o usuário, o Postgres recusa e TUDO é desfeito

-- ── 4. RELIGAR os gatilhos e CONFERIR ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE colaborador_lancamentos ENABLE TRIGGER trg_colaborador_lancamentos_imutavel;
ALTER TABLE colaborador_lancamentos ENABLE TRIGGER trg_colaborador_lancamentos_sem_truncate;
ALTER TABLE auditoria ENABLE TRIGGER trg_auditoria_imutavel;
ALTER TABLE auditoria ENABLE TRIGGER trg_auditoria_sem_truncate;
ALTER TABLE colaboradores ENABLE TRIGGER trg_colaboradores_sem_delete;
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname IN ('trg_colaborador_lancamentos_imutavel','trg_colaborador_lancamentos_sem_truncate','trg_auditoria_imutavel','trg_auditoria_sem_truncate','trg_colaboradores_sem_delete') AND tgenabled = 'O';
  IF n <> 5 THEN RAISE EXCEPTION 'ABORTADO: só % de 5 gatilhos estão ligados.', n; END IF;
  SELECT count(*) INTO n FROM colaboradores WHERE NOT interno;  IF n <> 0 THEN RAISE EXCEPTION 'ABORTADO: sobrou colaborador não interno (%).', n; END IF;
  SELECT count(*) INTO n FROM colaborador_lancamentos;           IF n <> 0 THEN RAISE EXCEPTION 'ABORTADO: o livro não ficou vazio (%).', n; END IF;
END $$;

\echo '== CONTAGENS DEPOIS (dentro da transação)'
SELECT 'colaboradores (só o interno deve restar)' AS item, count(*) AS n FROM colaboradores
UNION ALL SELECT 'usuários', count(*) FROM users
UNION ALL SELECT 'ocorrências', count(*) FROM objects
UNION ALL SELECT 'boosts', count(*) FROM boosts
UNION ALL SELECT 'livro', count(*) FROM colaborador_lancamentos
UNION ALL SELECT 'auditoria', count(*) FROM auditoria
UNION ALL SELECT 'sinais', count(*) FROM colaborador_sinais
UNION ALL SELECT 'saques', count(*) FROM colaborador_saques;

-- ── 5. FIM: por padrão DESFAZ tudo. Só troque por COMMIT com ordem expressa do fundador. ─────────────────────────────────
ROLLBACK;
