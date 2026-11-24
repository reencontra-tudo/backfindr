-- Migration 030 -- Programa de Colaboradores, etapa E7 (admin): trilha de AUDITORIA (só INSERT).
--
-- NÃO APLICADA: entregue no PR, para autorização (ordem escrita do Marcos, com o backup do dia conferido). Independe das outras (usa só `users`).
-- ADITIVA: 1 tabela nova; nada existente é alterado. O código só usa isto com COLABORADORES_ATIVO=1 (telas e rotas do admin do programa); sem a chave, nada lê nem grava aqui.
-- `auditoria`: toda ação do admin sobre colaboradores, verificações, saques, ajustes e regras grava uma linha (quem, o quê, em quem, antes/depois resumidos, motivo).
--   Só aceita INSERT (gatilho recusa UPDATE, DELETE e TRUNCATE). Nada de dado pessoal sensível em `antes`/`depois` (sem chave PIX, sem documento).
-- RLS ligado e SEM política, grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  acao        TEXT NOT NULL CHECK (char_length(acao) BETWEEN 3 AND 60),
  alvo_tipo   TEXT NOT NULL CHECK (char_length(alvo_tipo) BETWEEN 3 AND 40),
  alvo_id     TEXT NOT NULL CHECK (char_length(alvo_id) BETWEEN 1 AND 80),
  antes       JSONB,
  depois      JSONB,
  motivo      TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_alvo ON auditoria (alvo_tipo, alvo_id, criado_em);

CREATE OR REPLACE FUNCTION auditoria_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria: a trilha só aceita INSERT';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_auditoria_imutavel ON auditoria;
CREATE TRIGGER trg_auditoria_imutavel BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();
DROP TRIGGER IF EXISTS trg_auditoria_sem_truncate ON auditoria;
CREATE TRIGGER trg_auditoria_sem_truncate BEFORE TRUNCATE ON auditoria FOR EACH STATEMENT EXECUTE FUNCTION auditoria_imutavel();

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON TABLE auditoria FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON TABLE auditoria FROM authenticated'; END IF;
END $$;

-- Verificação após aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name = 'auditoria';   -- 1 linha
--   select count(*) from auditoria;                                                    -- esperado: 0
--
-- Reversão (tabela nova; o código do admin do programa volta a funcionar sem a chave COLABORADORES_ATIVO):
--   DROP TABLE IF EXISTS auditoria;  DROP FUNCTION IF EXISTS auditoria_imutavel();
