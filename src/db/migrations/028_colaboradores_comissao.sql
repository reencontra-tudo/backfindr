-- Migration 028 -- Programa de Colaboradores, etapa E4 (comissão em MODO SOMBRA): configuração versionada, caixa de entrada de pagamentos e livro de lançamentos.
--
-- NÃO APLICADA: entregue no PR, para autorização (ordem escrita do Marcos, com o backup do dia conferido, como na 026).
-- ADITIVA: cria 3 tabelas novas e UM índice único parcial novo em `boosts` (hoje 2 linhas, sem `provider_ref` repetido: conferido por leitura em 24/11/2026).
-- Não altera nem remove coluna, tipo, constraint ou linha existente. O código só usa isto com COMISSAO_SOMBRA=1 (e COLABORADORES_ATIVO=1); sem a chave,
-- nada lê nem grava aqui. MODO SOMBRA: calcula e grava; NADA é mostrado a colaborador algum (a tela é a E6).
--
-- `programa_config`: regras versionadas (chave, valor, vigente_desde). Mudança só vale daqui para frente: o cálculo de uma compra usa a linha vigente na hora da compra.
--   Valores iniciais (decisões do fundador, 24/11/2026): comissão 25 % do valor BRUTO pago, arredondado PARA BAIXO; prazo de liberação 14 dias; saque mínimo R$ 50;
--   10 dias úteis (só dias de semana); exclusão por transgressão cancela o saldo.
-- `pagamento_eventos`: caixa de entrada (registro de cada aviso de pagamento processado; sem dado pessoal: só valores e estado).
-- `colaborador_lancamentos`: LIVRO só de INSERT (gatilho recusa UPDATE, DELETE e TRUNCATE). Saldo é sempre soma, nunca campo editável. `chave_idempotencia` ÚNICA:
--   o mesmo pagamento nunca gera dois lançamentos. Estorno = lançamento negativo. Correção só por lançamento de ajuste com motivo (E7).
-- RLS ligado e SEM política nas tabelas novas, grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS programa_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave          TEXT NOT NULL CHECK (chave ~ '^[a-z_]{3,60}$'),
  valor          TEXT NOT NULL CHECK (char_length(valor) BETWEEN 1 AND 200),
  vigente_desde  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por     UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo         TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_programa_config_chave_vigencia ON programa_config (chave, vigente_desde);

INSERT INTO programa_config (chave, valor, vigente_desde, motivo) VALUES
  ('comissao_percentual',      '25',    '2000-01-01', 'decisão do fundador, 24/11/2026: 25 % do valor bruto pago'),
  ('comissao_arredondamento',  'baixo', '2000-01-01', 'decisão do fundador, 24/11/2026: arredondar o centavo para baixo'),
  ('prazo_liberacao_dias',     '14',    '2000-01-01', 'decisão do fundador, 24/11/2026: 14 dias, configurável'),
  ('saque_minimo_centavos',    '5000',  '2000-01-01', 'decisão do fundador, 24/11/2026: R$ 50'),
  ('prazo_saque_dias_uteis',   '10',    '2000-01-01', 'decisão do fundador, 24/11/2026: só dias de semana'),
  ('exclusao_cancela_saldo',   'sim',   '2000-01-01', 'decisão do fundador, 24/11/2026: só exclusão por transgressão; sujeito a parecer jurídico')
ON CONFLICT (chave, vigente_desde) DO NOTHING;

CREATE TABLE IF NOT EXISTS pagamento_eventos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL CHECK (provider IN ('mercadopago')),
  pagamento_id  TEXT NOT NULL CHECK (char_length(pagamento_id) BETWEEN 1 AND 64),
  status        TEXT NOT NULL CHECK (char_length(status) BETWEEN 1 AND 40),
  resumo        JSONB NOT NULL DEFAULT '{}'::jsonb,
  recebido_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tentativas    INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamento_eventos ON pagamento_eventos (provider, pagamento_id, status);

CREATE TABLE IF NOT EXISTS colaborador_lancamentos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id       UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('comissao','estorno','saque_reservado','saque_pago','saque_cancelado','ajuste_admin','cancelamento_exclusao')),
  valor_centavos       INTEGER NOT NULL CHECK (valor_centavos <> 0),
  moeda                TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
  boost_id             UUID REFERENCES boosts(id) ON DELETE RESTRICT,
  objeto_id            UUID,
  pagamento_ref        TEXT,
  percentual_aplicado  NUMERIC(5,2) CHECK (percentual_aplicado IS NULL OR (percentual_aplicado >= 0 AND percentual_aplicado <= 100)),
  base_centavos        INTEGER CHECK (base_centavos IS NULL OR base_centavos >= 0),
  disponivel_em        TIMESTAMPTZ,
  chave_idempotencia   TEXT NOT NULL CHECK (char_length(chave_idempotencia) BETWEEN 3 AND 200),
  em_analise           BOOLEAN NOT NULL DEFAULT FALSE,
  motivo               TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500),
  criado_por           UUID REFERENCES users(id) ON DELETE SET NULL,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lancamento_sinal_do_tipo CHECK (
    (tipo = 'comissao' AND valor_centavos > 0) OR (tipo IN ('estorno','saque_reservado','saque_pago','cancelamento_exclusao') AND valor_centavos < 0)
    OR tipo IN ('saque_cancelado','ajuste_admin'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaborador_lancamentos_chave ON colaborador_lancamentos (chave_idempotencia);
CREATE INDEX IF NOT EXISTS idx_colaborador_lancamentos_colab ON colaborador_lancamentos (colaborador_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_colaborador_lancamentos_pagamento ON colaborador_lancamentos (pagamento_ref) WHERE pagamento_ref IS NOT NULL;

-- Livro imutável: só INSERT. Correção = novo lançamento (ajuste com motivo).
CREATE OR REPLACE FUNCTION colaborador_lancamentos_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'colaborador_lancamentos: o livro só aceita INSERT (corrija com um lançamento de ajuste)';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_colaborador_lancamentos_imutavel ON colaborador_lancamentos;
CREATE TRIGGER trg_colaborador_lancamentos_imutavel BEFORE UPDATE OR DELETE ON colaborador_lancamentos
  FOR EACH ROW EXECUTE FUNCTION colaborador_lancamentos_imutavel();
DROP TRIGGER IF EXISTS trg_colaborador_lancamentos_sem_truncate ON colaborador_lancamentos;
CREATE TRIGGER trg_colaborador_lancamentos_sem_truncate BEFORE TRUNCATE ON colaborador_lancamentos
  FOR EACH STATEMENT EXECUTE FUNCTION colaborador_lancamentos_imutavel();

-- Idempotência do pagamento também em `boosts` (o mesmo pagamento do Mercado Pago nunca vira dois boosts, mesmo sem a trava da aplicação).
CREATE UNIQUE INDEX IF NOT EXISTS uq_boosts_provider_ref ON boosts (provider, provider_ref) WHERE provider_ref IS NOT NULL;

ALTER TABLE programa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamento_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_lancamentos ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['programa_config','pagamento_eventos','colaborador_lancamentos'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t); END IF;
  END LOOP;
END $$;

-- Verificação após aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name in ('programa_config','pagamento_eventos','colaborador_lancamentos');   -- 3 linhas
--   select chave, valor from programa_config order by chave;                                                                                -- 6 linhas
--   select count(*) from colaborador_lancamentos; select count(*) from pagamento_eventos;                                                   -- esperado: 0 e 0
--   select indexname from pg_indexes where tablename = 'boosts' and indexname = 'uq_boosts_provider_ref';                                   -- 1 linha
--   select count(*) from boosts;                                                                                                            -- esperado: o mesmo de antes (2)
--
-- Reversão (tabelas e índice novos; o código volta a funcionar sem a chave COMISSAO_SOMBRA):
--   DROP INDEX IF EXISTS uq_boosts_provider_ref;
--   DROP TABLE IF EXISTS colaborador_lancamentos;  DROP FUNCTION IF EXISTS colaborador_lancamentos_imutavel();
--   DROP TABLE IF EXISTS pagamento_eventos;  DROP TABLE IF EXISTS programa_config;
