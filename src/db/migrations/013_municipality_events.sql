-- ============================================================
-- BACKFINDR — Migration 013
-- municipality_events (Item C da diversificação de conteúdo)
-- Idempotente — pode ser executada múltiplas vezes
--
-- Contexto: enriquecimento de conteúdo local pras páginas de cidade,
-- cobrindo 3 tipos de fato cívico/cultural por município:
--   - founding_date: data de fundação/aniversário da cidade
--   - municipal_holiday: feriado municipal oficial (padroeiro, data
--     comemorativa local)
--   - festival: evento/festa tradicional recorrente (pode haver mais
--     de um por cidade)
-- Mesma disciplina de sempre: fonte real obrigatória (site da
-- prefeitura, IBGE, ou fonte histórica/cívica confiável), nunca
-- inventado. Ausência de fonte confiável = não popular a linha, não
-- forçar.
-- ============================================================

CREATE TABLE IF NOT EXISTS municipality_events (
  id              SERIAL PRIMARY KEY,
  municipality_id INTEGER NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('founding_date', 'municipal_holiday', 'festival')),
  name            TEXT NOT NULL,
  description     TEXT,
  date_text       TEXT,       -- forma legível: "25 de janeiro", "3º fim de semana de julho", etc — datas de festival variam de ano pra ano, por isso texto livre em vez de DATE fixo
  month           SMALLINT,   -- 1-12, quando a data for fixa ou tiver mês certo — usado pra ordenação/filtro
  day             SMALLINT,   -- 1-31, quando a data for fixa
  source_url      TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipality_events_municipality_id ON municipality_events(municipality_id);
CREATE INDEX IF NOT EXISTS idx_municipality_events_type ON municipality_events(event_type);

COMMENT ON TABLE municipality_events IS
  'Fatos cívicos/culturais por município: fundação, feriado municipal oficial, festas tradicionais recorrentes. Fonte obrigatória e verificável por linha — sem fonte confiável, a linha não é criada.';
COMMENT ON COLUMN municipality_events.date_text IS
  'Data em texto livre, não DATE fixo — festivais recorrentes variam de dia a cada ano (ex: "3º fim de semana de julho"), então a representação textual é mais honesta que uma data fixa.';
COMMENT ON COLUMN municipality_events.source_url IS
  'Fonte oficial (prefeitura, IBGE, lei municipal) ou fonte histórica/cívica confiável — nunca agregador de terceiros.';
