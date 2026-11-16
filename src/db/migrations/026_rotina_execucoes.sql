-- Migration 026 -- marca de vida das rotinas agendadas e controle de frequência dos avisos do vigia
--
-- NÃO APLICADA: entregue no PR, para autorização antes de rodar no SQL Editor.
--
-- `rotina_execucoes`: UMA LINHA POR CHAMADA AUTENTICADA de uma rotina agendada (matching, lembretes de «encontrei», ingestão de sinais).
-- Só de inclusão: o código nunca altera nem apaga linhas. `resultado`: 'ok', 'erro' ou 'desligada' (matching com a chave desligada, que conta como viva).
-- `resumo`: só CONTAGENS (números e verdadeiro/falso). Nunca dado pessoal, texto livre, mensagem de erro nem segredo.
-- Chamada com segredo errado (401) NÃO grava: sem isso qualquer pessoa poderia forjar marca de vida.
--
-- `rotina_alertas`: um aviso do vigia por linha ('falha' ou 'normalizada'), para limitar a frequência (no máximo 1 aviso de falha por rotina a cada 6 horas)
-- e para avisar uma única vez quando a rotina voltar ao normal. Também só de inclusão.
--
-- Retenção (proposta, NADA é apagado agora): guardar 13 meses das marcas (cerca de 35 mil linhas por ano só do matching, a cada 15 minutos; texto curto).
-- Depois disso, a decisão de resumir ou apagar fica para o Marcos, com ordem escrita; este arquivo e o código não apagam nada.
--
-- RLS ligado e NENHUMA policy; grants de anon e authenticated revogados (a aplicação usa a conexão direta do servidor, que não passa por RLS).
-- Aditiva e idempotente. O código funciona sem estas tabelas: sem elas, a rotina segue idêntica e o vigia responde «sem dados» sem avisar ninguém.

CREATE TABLE IF NOT EXISTS rotina_execucoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina      TEXT NOT NULL,
  iniciou_em  TIMESTAMPTZ NOT NULL,
  terminou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resultado   TEXT NOT NULL CHECK (resultado IN ('ok', 'erro', 'desligada')),
  resumo      JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rotina_execucoes_rotina_inicio ON rotina_execucoes (rotina, iniciou_em DESC);

CREATE TABLE IF NOT EXISTS rotina_alertas (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina    TEXT NOT NULL,
  tipo      TEXT NOT NULL CHECK (tipo IN ('falha', 'normalizada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rotina_alertas_rotina_criado ON rotina_alertas (rotina, criado_em DESC);

ALTER TABLE rotina_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotina_alertas ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE rotina_execucoes, rotina_alertas FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE rotina_execucoes, rotina_alertas FROM authenticated';
  END IF;
END $$;

-- Verificação após aplicar (somente leitura):
--   select relname, relrowsecurity from pg_class where relname in ('rotina_execucoes','rotina_alertas');   -- esperado: true, true
--   select count(*) from pg_policies where tablename in ('rotina_execucoes','rotina_alertas');            -- esperado: 0
--   select has_table_privilege('anon', 'rotina_execucoes', 'SELECT'),
--          has_table_privilege('authenticated', 'rotina_execucoes', 'SELECT');                            -- esperado: false, false
--   select count(*) from rotina_execucoes; select count(*) from rotina_alertas;                           -- esperado: 0, 0 (antes da primeira chamada)
--
-- Reversão (as tabelas são novas e só guardam marcas e avisos; ao removê-las as rotinas seguem idênticas e o vigia responde «sem dados»):
--   DROP TABLE IF EXISTS rotina_alertas; DROP TABLE IF EXISTS rotina_execucoes;
