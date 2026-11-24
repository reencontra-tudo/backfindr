-- Migration 027 -- Programa de Colaboradores, etapa E5 (autoatendimento): aceite da política, verificação do canal e data de saída.
--
-- NÃO APLICADA: entregue no PR, para autorização (ordem escrita do Marcos, com backup do dia conferido, como na 026).
-- 100% ADITIVA: cria 2 tabelas novas e acrescenta 1 coluna NULA em `colaboradores` (que existe desde a 026). Não altera nem remove nada existente.
-- O código novo só usa estas estruturas com COLABORADORES_ATIVO=1 E COLABORADORES_INSCRICAO=1 (inscrição só por link, noindex, fora de menu até a
-- revisão jurídica). Sem as chaves, nada lê nem grava aqui.
--
-- `politica_aceites`: um registro por pessoa e versão da política (sem IP e sem dispositivo: minimização, DESENHO §3.2).
-- `colaborador_verificacoes`: fila de verificação do canal (código `BF-XXXX-XXXX`, distinto do código curto). Troca de canal cria nova linha e
--   suspende a liberação (`colaboradores.verificado_em` volta a NULL). Aprovação MANUAL pelo fundador no começo (E7 traz a tela).
-- `colaboradores.saiu_em`: quando o colaborador saiu por vontade própria (base da regra dos 12 meses do @nome, PC-13; a liberação do @nome é E5b).
-- RLS ligado e SEM política nas tabelas novas (a aplicação usa a conexão direta do servidor), grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS politica_aceites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  versao     TEXT NOT NULL CHECK (char_length(versao) BETWEEN 4 AND 20),
  aceito_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_aceites_user_versao ON politica_aceites (user_id, versao);

CREATE TABLE IF NOT EXISTS colaborador_verificacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  codigo          TEXT NOT NULL CHECK (codigo ~ '^BF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  canal_url       TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aprovada','recusada','substituida')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decidido_em     TIMESTAMPTZ,
  decidido_por    UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo          TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaborador_verificacoes_codigo ON colaborador_verificacoes (codigo);
CREATE INDEX IF NOT EXISTS idx_colaborador_verificacoes_colab ON colaborador_verificacoes (colaborador_id, estado);

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS saiu_em TIMESTAMPTZ;

ALTER TABLE politica_aceites ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_verificacoes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE politica_aceites FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE colaborador_verificacoes FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE politica_aceites FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE colaborador_verificacoes FROM authenticated';
  END IF;
END $$;

-- Verificação após aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name in ('politica_aceites','colaborador_verificacoes');   -- 2 linhas
--   select column_name, is_nullable from information_schema.columns where table_name = 'colaboradores' and column_name = 'saiu_em';  -- 1 linha, YES
--   select count(*) from politica_aceites; select count(*) from colaborador_verificacoes;                                  -- esperado: 0 e 0
--   select count(*) from colaboradores;                                                                                     -- esperado: 1 (o @backfindr), intacto
--
-- Reversão (tabelas e coluna novas; o código volta a funcionar sem as chaves):
--   DROP TABLE IF EXISTS colaborador_verificacoes;
--   DROP TABLE IF EXISTS politica_aceites;
--   ALTER TABLE colaboradores DROP COLUMN IF EXISTS saiu_em;
