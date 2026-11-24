-- Migration 029 -- Programa de Colaboradores, etapa E6 (painel): dados de pagamento (cifrados) e pedidos de saque.
--
-- NÃO APLICADA: entregue no PR, para autorização (ordem escrita do Marcos, com o backup do dia conferido). Depende da 026 e da 028 (livro de lançamentos).
-- ADITIVA: 2 tabelas novas; nada existente é alterado. O código só usa isto com COLABORADORES_ATIVO=1, COLABORADORES_INSCRICAO=1 e COLABORADORES_SAQUE=1.
-- DADOS DE PAGAMENTO (LGPD, POLÍTICA §7: «usados só para o repasse e guardados com segurança»): a chave PIX e o documento ficam CIFRADOS (AES-256-GCM,
-- chave de cifragem na variável de ambiente PIX_CHAVE_CIFRAGEM, fora do banco); a tela mostra só o final. Sem a variável, o código recusa gravar.
-- `colaborador_saques`: um pedido ABERTO por colaborador (índice único parcial). O dinheiro só se move por lançamentos do livro (`saque_reservado`, `saque_pago`, `saque_cancelado`).
-- RLS ligado e SEM política, grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS colaborador_dados_pagamento (
  colaborador_id    UUID PRIMARY KEY REFERENCES colaboradores(id) ON DELETE RESTRICT,
  tipo_chave        TEXT NOT NULL CHECK (tipo_chave IN ('cpf','cnpj','email','telefone','aleatoria')),
  chave_cifrada     TEXT NOT NULL,
  chave_final       TEXT NOT NULL CHECK (char_length(chave_final) BETWEEN 1 AND 6),
  titular_nome      TEXT NOT NULL CHECK (char_length(titular_nome) BETWEEN 2 AND 120),
  documento_tipo    TEXT NOT NULL CHECK (documento_tipo IN ('cpf','cnpj')),
  documento_cifrado TEXT NOT NULL,
  documento_final   TEXT NOT NULL CHECK (char_length(documento_final) BETWEEN 1 AND 6),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaborador_saques (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  valor_centavos    INTEGER NOT NULL CHECK (valor_centavos > 0),
  estado            TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','pago','recusado','cancelado')),
  solicitado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decidido_em       TIMESTAMPTZ,
  decidido_por      UUID REFERENCES users(id) ON DELETE SET NULL,
  comprovante       TEXT CHECK (comprovante IS NULL OR char_length(comprovante) <= 300),
  motivo            TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaborador_saques_aberto ON colaborador_saques (colaborador_id) WHERE estado = 'solicitado';
CREATE INDEX IF NOT EXISTS idx_colaborador_saques_colab ON colaborador_saques (colaborador_id, solicitado_em);

ALTER TABLE colaborador_dados_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_saques ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['colaborador_dados_pagamento','colaborador_saques'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t); END IF;
  END LOOP;
END $$;

-- Verificação após aplicar (somente leitura):
--   select table_name from information_schema.tables where table_name in ('colaborador_dados_pagamento','colaborador_saques');   -- 2 linhas
--   select count(*) from colaborador_dados_pagamento; select count(*) from colaborador_saques;                                   -- esperado: 0 e 0
--
-- Reversão (tabelas novas; o código volta a funcionar sem a chave COLABORADORES_SAQUE):
--   DROP TABLE IF EXISTS colaborador_saques;  DROP TABLE IF EXISTS colaborador_dados_pagamento;
