-- Reaction types + polymorphic reactions (works / wiki entries / timeline events)
-- The backend reaction-config.ts is the source of truth; syncReactionTypes() upserts
-- these rows on boot so the frontend can fetch icon/label/type from the DB.

CREATE TABLE IF NOT EXISTS reaction_types (
  key         TEXT PRIMARY KEY,
  label       VARCHAR(32) NOT NULL,
  icon        VARCHAR(16) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  target_type   VARCHAR(16) NOT NULL
                CHECK (target_type IN ('work', 'entry', 'timeline')),
  target_id     UUID NOT NULL,
  reaction_type TEXT NOT NULL REFERENCES reaction_types(key),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS reactions_target_idx
  ON reactions (target_type, target_id);
CREATE INDEX IF NOT EXISTS reactions_user_idx
  ON reactions (user_id, created_at DESC);
