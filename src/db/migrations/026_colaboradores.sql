-- Migration 026 -- Programa de Colaboradores, etapa E1 (atribuição): tabela `colaboradores` e 2 colunas opcionais em `objects`
--
-- NÃO APLICADA: entregue no PR, para autorização antes de rodar no SQL Editor (ordem escrita do Marcos).
-- 100% ADITIVA: só cria tabela, índices, função e gatilho novos e acrescenta 2 colunas NULAS em `objects`. Não altera nem remove nenhuma
-- coluna, tipo, constraint, índice ou linha existente (nem do legado). Linhas já gravadas ficam com as 2 colunas nulas.
-- O código só usa estas colunas com COLABORADORES_ATIVO=1; sem a chave, nada lê nem grava nelas e o cadastro de ocorrência funciona como hoje.
--
-- `colaboradores`: um por canal (no piloto, só o próprio Backfindr, criado pelo admin). `slug` é o @nome (3 a 30; a-z0-9-; único sem diferenciar
-- maiúscula; nunca reutilizado: a linha NUNCA é apagada). `codigo_curto` é o código exclusivo gerado pelo sistema (4 ou 5 caracteres de um alfabeto
-- sem 0, O, 1, I). `interno` = verdadeiro para o Backfindr (nunca comissiona). `user_id` pode ser nulo (colaborador interno sem conta própria).
-- `objects.colaborador_id` / `objects.colaborador_codigo`: a atribuição, gravada UMA vez, no mesmo INSERT da ocorrência. O texto do código fica na
-- ocorrência mesmo se o colaborador sair (FK RESTRICT: o colaborador com ocorrências não pode ser apagado).
-- IMUTABILIDADE: o gatilho abaixo recusa qualquer mudança nessas 2 colunas depois do cadastro (inclusive de nulo para valor). Ele só dispara quando
-- uma delas muda (WHEN), então não afeta nenhum outro UPDATE de `objects`.
--
-- RLS ligado e SEM política em `colaboradores` (a aplicação usa a conexão direta do servidor), grants de anon/authenticated revogados.

CREATE TABLE IF NOT EXISTS colaboradores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  slug            TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  codigo_curto    TEXT NOT NULL CHECK (codigo_curto ~ '^[2-9A-HJ-NP-Z]{4,5}$'),
  nome            TEXT NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 80),
  descricao       TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 500),
  imagem_url      TEXT,
  canal_url       TEXT,
  regiao_cidade   TEXT,
  regiao_uf       TEXT CHECK (regiao_uf IS NULL OR regiao_uf ~ '^[A-Z]{2}$'),
  regiao_lat      NUMERIC,
  regiao_lng      NUMERIC,
  raio_km         INTEGER CHECK (raio_km IS NULL OR raio_km BETWEEN 1 AND 500),
  modalidade      TEXT NOT NULL DEFAULT 'comunidade_criador'
                  CHECK (modalidade IN ('comunidade_criador','pessoa_fisica','comercio_condominio','instituicao')),
  estado          TEXT NOT NULL DEFAULT 'ativo' CHECK (estado IN ('ativo','suspenso','excluido','saiu')),
  interno         BOOLEAN NOT NULL DEFAULT FALSE,
  verificado_em   TIMESTAMPTZ,
  verificado_por  UUID REFERENCES users(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_slug   ON colaboradores (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_codigo ON colaboradores (upper(codigo_curto));
CREATE UNIQUE INDEX IF NOT EXISTS uq_colaboradores_user   ON colaboradores (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE colaboradores FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE colaboradores FROM authenticated';
  END IF;
END $$;

-- A linha de colaborador nunca é apagada (rastro; o @nome nunca é reutilizado). Excluir = mudar `estado`.
CREATE OR REPLACE FUNCTION colaboradores_sem_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'colaboradores: a linha nunca é apagada (use estado = excluido ou saiu)';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_colaboradores_sem_delete ON colaboradores;
CREATE TRIGGER trg_colaboradores_sem_delete BEFORE DELETE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION colaboradores_sem_delete();

-- Atribuição na ocorrência: 2 colunas opcionais, nulas por padrão.
ALTER TABLE objects ADD COLUMN IF NOT EXISTS colaborador_id     UUID REFERENCES colaboradores(id) ON DELETE RESTRICT;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS colaborador_codigo TEXT;
CREATE INDEX IF NOT EXISTS idx_objects_colaborador ON objects (colaborador_id) WHERE colaborador_id IS NOT NULL;

-- Imutabilidade: depois do INSERT, nenhuma das 2 colunas muda (nem de nulo para valor).
CREATE OR REPLACE FUNCTION objects_colaborador_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'objects: colaborador_id e colaborador_codigo não podem mudar depois do cadastro';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_objects_colaborador_imutavel ON objects;
CREATE TRIGGER trg_objects_colaborador_imutavel
  BEFORE UPDATE OF colaborador_id, colaborador_codigo ON objects
  FOR EACH ROW
  WHEN (OLD.colaborador_id IS DISTINCT FROM NEW.colaborador_id OR OLD.colaborador_codigo IS DISTINCT FROM NEW.colaborador_codigo)
  EXECUTE FUNCTION objects_colaborador_imutavel();

-- Verificação após aplicar (somente leitura):
--   select column_name, is_nullable, data_type from information_schema.columns where table_name = 'objects' and column_name in ('colaborador_id','colaborador_codigo');  -- 2 linhas, YES
--   select count(*) from objects where colaborador_id is not null or colaborador_codigo is not null;   -- esperado: 0
--   select relname, relrowsecurity from pg_class where relname = 'colaboradores';                      -- esperado: true
--   select count(*) from colaboradores;                                                                 -- esperado: 0 (o @backfindr é criado depois, por ordem do Marcos)
--
-- Reversão (a tabela e as colunas são novas; ao removê-las o código volta a funcionar sem a chave COLABORADORES_ATIVO):
--   DROP TRIGGER IF EXISTS trg_objects_colaborador_imutavel ON objects;
--   DROP FUNCTION IF EXISTS objects_colaborador_imutavel();
--   DROP INDEX IF EXISTS idx_objects_colaborador;
--   ALTER TABLE objects DROP COLUMN IF EXISTS colaborador_codigo;
--   ALTER TABLE objects DROP COLUMN IF EXISTS colaborador_id;
--   DROP TRIGGER IF EXISTS trg_colaboradores_sem_delete ON colaboradores;
--   DROP TABLE IF EXISTS colaboradores;
--   DROP FUNCTION IF EXISTS colaboradores_sem_delete();
