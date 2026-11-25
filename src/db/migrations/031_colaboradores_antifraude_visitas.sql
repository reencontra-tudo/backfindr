-- Migration 031 -- Programa de Colaboradores, etapa E8: SINAIS de antifraude (para análise manual) e contador de VISITAS agregado.
--
-- NÃO APLICADA: entregue no PR, para autorização (ordem escrita do Marcos, com o backup do dia conferido pelo NAV). Independe de dados das outras (usa colaboradores e users).
-- ADITIVA: 2 tabelas novas; nada existente é alterado. O código só usa estas tabelas com COLABORADORES_ATIVO=1 e, respectivamente, COLABORADORES_ANTIFRAUDE=1 e
-- COLABORADORES_VISITAS=1; sem as chaves, nada lê nem grava aqui.
-- `colaborador_sinais`: SINAIS para ANÁLISE MANUAL, nunca bloqueio automático de pessoa. Um sinal de uma compra (`bloqueia` = verdadeiro, com `pagamento_ref`) mantém aquela comissão
--   FORA do saldo disponível até o admin decidir (descartar libera; confirmar mantém retida). Sinal do colaborador (`bloqueia` = falso) só avisa. O livro de lançamentos continua só-INSERT:
--   a retenção vem desta tabela, não de alterar o lançamento. `detalhe` guarda só números e tipos (nunca e-mail, nome ou identificador de pessoa).
-- `colaborador_visitas_dia`: contagem AGREGADA por colaborador e dia. SEM IP, SEM cookie, SEM identificador, SEM dispositivo (DESENHO §3.8, decisão #13): conta também robôs (número aproximado).
-- RLS ligado e SEM política, grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS colaborador_sinais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('pagador_igual_colaborador','pagador_repetido','contas_novas_com_codigo','pico_de_ocorrencias')),
  pagamento_ref   TEXT,
  bloqueia        BOOLEAN NOT NULL DEFAULT FALSE,
  detalhe         JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado          TEXT NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto','descartado','confirmado')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decidido_em     TIMESTAMPTZ,
  decidido_por    UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo          TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  chave           TEXT NOT NULL CHECK (char_length(chave) BETWEEN 3 AND 200)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaborador_sinais_chave ON colaborador_sinais (chave);
CREATE INDEX IF NOT EXISTS idx_colaborador_sinais_colab ON colaborador_sinais (colaborador_id, estado);
CREATE INDEX IF NOT EXISTS idx_colaborador_sinais_pagamento ON colaborador_sinais (pagamento_ref) WHERE pagamento_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS colaborador_visitas_dia (
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  dia             DATE NOT NULL,
  visitas         INTEGER NOT NULL DEFAULT 0 CHECK (visitas >= 0),
  PRIMARY KEY (colaborador_id, dia)
);

ALTER TABLE colaborador_sinais ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_visitas_dia ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['colaborador_sinais','colaborador_visitas_dia'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t); END IF;
  END LOOP;
END $$;

-- Verificação após aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name in ('colaborador_sinais','colaborador_visitas_dia');   -- 2 linhas
--   select count(*) from colaborador_sinais; select count(*) from colaborador_visitas_dia;                                    -- esperado: 0 e 0
--
-- Reversão (tabelas novas; o código volta a funcionar sem as chaves COLABORADORES_ANTIFRAUDE e COLABORADORES_VISITAS):
--   DROP TABLE IF EXISTS colaborador_visitas_dia;  DROP TABLE IF EXISTS colaborador_sinais;
