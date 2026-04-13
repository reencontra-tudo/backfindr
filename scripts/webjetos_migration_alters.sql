-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFINDR — Migrações para importação Webjetos
-- Executar no Supabase: SQL Editor → colar e rodar
-- Seguro para rodar múltiplas vezes (IF NOT EXISTS em tudo)
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. USERS — colunas legadas ───────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS legacy_id               integer UNIQUE,
  ADD COLUMN IF NOT EXISTS whatsapp                varchar(20),
  ADD COLUMN IF NOT EXISTS password_reset_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_legacy               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source                  varchar(50);

-- ── 2. OBJECTS — colunas legadas ─────────────────────────────────────────────
ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS legacy_id               integer UNIQUE,
  ADD COLUMN IF NOT EXISTS occurrence_description  text,
  ADD COLUMN IF NOT EXISTS occurrence_type         varchar(30),
  ADD COLUMN IF NOT EXISTS occurrence_date         date,
  ADD COLUMN IF NOT EXISTS occurrence_time_range   varchar(50),
  ADD COLUMN IF NOT EXISTS police_report_number    varchar(50),
  ADD COLUMN IF NOT EXISTS police_station          varchar(255),
  ADD COLUMN IF NOT EXISTS subject_name            varchar(255),
  ADD COLUMN IF NOT EXISTS subject_gender          varchar(1),
  ADD COLUMN IF NOT EXISTS brand                   varchar(100),
  ADD COLUMN IF NOT EXISTS model                   varchar(255),
  ADD COLUMN IF NOT EXISTS color                   varchar(100),
  ADD COLUMN IF NOT EXISTS serial_number           varchar(100),
  ADD COLUMN IF NOT EXISTS manufacture_year        smallint,
  ADD COLUMN IF NOT EXISTS license_plate           varchar(10),
  ADD COLUMN IF NOT EXISTS breed                   varchar(100),
  ADD COLUMN IF NOT EXISTS reward_offered          boolean,
  ADD COLUMN IF NOT EXISTS reward_amount           decimal(10,2),
  ADD COLUMN IF NOT EXISTS document_type           varchar(20),
  ADD COLUMN IF NOT EXISTS country_of_origin       varchar(100),
  ADD COLUMN IF NOT EXISTS views_count             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_legacy               boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source                  varchar(50);

-- ── 3. TABELA DE TOKENS DE RESET ─────────────────────────────────────────────
-- Usada pelo script reativar_usuarios_webjetos.py
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token      varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used       boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ── 4. ÍNDICES DE PERFORMANCE ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_objects_legacy_id  ON objects(legacy_id)  WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objects_is_legacy  ON objects(is_legacy)  WHERE is_legacy = true;
CREATE INDEX IF NOT EXISTS idx_objects_status_loc ON objects(status, location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_users_legacy_id    ON users(legacy_id)    WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_legacy    ON users(is_legacy)    WHERE is_legacy = true;
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);

-- ── 5. VERIFICAÇÃO ────────────────────────────────────────────────────────────
-- Rodar após aplicar para confirmar que as colunas existem:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'objects'
  AND column_name IN ('legacy_id','is_legacy','brand','color','breed','source')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('legacy_id','is_legacy','whatsapp','source')
ORDER BY column_name;
