-- Migration 025 -- área de mensagens entre quem achou e o dono (Fase 1): tabelas `conversas` e `mensagens_conversa`
--
-- NÃO APLICADA: entregue no PR, para autorização antes de rodar no SQL Editor.
-- Aditiva (só cria; não altera nenhuma tabela nem linha existente, nem do legado) e reversível (reversão no fim).
-- O código só usa estas tabelas com a chave MENSAGENS_ATIVO=1; sem a chave, o aviso «encontrei» funciona como hoje.
--
-- `conversas`: um aviso de quem achou sobre um objeto (achador SEMPRE com conta). Pode apontar para dono e objeto
-- LEGADOS (exceção autorizada pelo Marcos): a linha nova aponta, nada do legado é alterado. Sem aceite do dono não há
-- conversa: o aviso fica em `aguardando`. Estados: aguardando, aberta, recusada, encerrada, cancelada, arquivada,
-- bloqueada (bloqueada é da Fase 2; o modelo já a comporta, junto com denúncia e disputa).
-- `mensagens_conversa`: as mensagens (texto ou de sistema).
-- Exclusão de conta: achador_id/dono_id/autor_id viram NULL (ON DELETE SET NULL): o autor fica anonimizado e a conversa
-- não é apagada em cascata. Se o objeto for apagado, object_id vira NULL; `objeto_titulo` guarda o título para a lista.
-- `retencao_ate`: gravada ao encerrar (12 meses) ou ao denunciar/disputar (até 3 anos). NENHUM apagamento é feito nesta fase.
--
-- RLS ligado, com política só para as duas partes (USING e WITH CHECK) e grants de anon revogados. A aplicação usa a
-- conexão direta do servidor e autoriza por participante no código; a política protege o acesso pela API REST do
-- Supabase (auth.uid()). As políticas só são criadas onde auth.uid() existe (Supabase); em Postgres comum ficam de fora.

CREATE TABLE IF NOT EXISTS conversas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id             UUID REFERENCES objects(id) ON DELETE SET NULL,
  objeto_titulo         TEXT,
  achador_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  dono_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  estado                TEXT NOT NULL DEFAULT 'aguardando'
                        CHECK (estado IN ('aguardando','aberta','recusada','encerrada','cancelada','arquivada','bloqueada')),
  primeira_mensagem     TEXT NOT NULL CHECK (char_length(primeira_mensagem) BETWEEN 1 AND 280),
  criada_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aceita_em             TIMESTAMPTZ,
  confirmado_dono_em    TIMESTAMPTZ,
  encerrada_em          TIMESTAMPTZ,
  encerrada_por         UUID REFERENCES users(id) ON DELETE SET NULL,
  motivo                TEXT CHECK (motivo IS NULL OR motivo IN ('devolvido','desisti','recusada','cancelado_achador','inatividade')),
  ultima_atividade      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retencao_ate          TIMESTAMPTZ,
  denunciada_em         TIMESTAMPTZ,
  denunciada_por        UUID REFERENCES users(id) ON DELETE SET NULL,
  em_disputa            BOOLEAN NOT NULL DEFAULT FALSE
);

-- 1 aviso ativo por achador e objeto
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversas_ativa_por_achador_objeto
  ON conversas (object_id, achador_id) WHERE estado IN ('aguardando','aberta');
CREATE INDEX IF NOT EXISTS idx_conversas_dono_estado    ON conversas (dono_id, estado);
CREATE INDEX IF NOT EXISTS idx_conversas_achador_estado ON conversas (achador_id, estado);
CREATE INDEX IF NOT EXISTS idx_conversas_object         ON conversas (object_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atividade      ON conversas (estado, ultima_atividade);

CREATE TABLE IF NOT EXISTS mensagens_conversa (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id  UUID NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  texto        TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  tipo         TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','sistema')),
  criada_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lida_em      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens_conversa (conversa_id, criada_em);

ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_conversa ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE conversas, mensagens_conversa FROM anon';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS conversas_somente_partes ON conversas';
    EXECUTE $p$CREATE POLICY conversas_somente_partes ON conversas FOR ALL
      USING (auth.uid() IN (achador_id, dono_id))
      WITH CHECK (auth.uid() IN (achador_id, dono_id))$p$;
    EXECUTE 'DROP POLICY IF EXISTS mensagens_conversa_somente_partes ON mensagens_conversa';
    EXECUTE $p$CREATE POLICY mensagens_conversa_somente_partes ON mensagens_conversa FOR ALL
      USING (EXISTS (SELECT 1 FROM conversas c WHERE c.id = mensagens_conversa.conversa_id AND auth.uid() IN (c.achador_id, c.dono_id)))
      WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM conversas c WHERE c.id = mensagens_conversa.conversa_id AND auth.uid() IN (c.achador_id, c.dono_id)))$p$;
  END IF;
END $$;

-- Verificação após aplicar (somente leitura):
--   select relname, relrowsecurity from pg_class where relname in ('conversas','mensagens_conversa');   -- esperado: true, true
--   select tablename, policyname, cmd from pg_policies where tablename in ('conversas','mensagens_conversa');  -- 2 políticas (Supabase)
--   select count(*) from conversas; select count(*) from mensagens_conversa;                            -- esperado: 0, 0
--
-- Reversão (as tabelas são novas; ao removê-las o código volta a funcionar sem a chave MENSAGENS_ATIVO):
--   DROP TABLE IF EXISTS mensagens_conversa; DROP TABLE IF EXISTS conversas;
