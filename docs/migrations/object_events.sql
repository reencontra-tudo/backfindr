CREATE TABLE IF NOT EXISTS object_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id   UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NULL,

  source      TEXT NOT NULL DEFAULT 'system',
  actor_type  TEXT NULL,
  actor_id    UUID NULL,

  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_object_events_object_id_created_at
  ON object_events(object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_events_type_created_at
  ON object_events(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_object_events_actor
  ON object_events(actor_type, actor_id)
  WHERE actor_id IS NOT NULL;
