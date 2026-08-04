-- Comments (polymorphic: works / wiki entries / timeline events)
-- + reaction_types gains a description column for the hover tooltip.

ALTER TABLE reaction_types
  ADD COLUMN IF NOT EXISTS description VARCHAR(200) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  target_type VARCHAR(16) NOT NULL
              CHECK (target_type IN ('work', 'entry', 'timeline')),
  target_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS comments_target_idx
  ON comments (target_type, target_id, created_at ASC);
CREATE INDEX IF NOT EXISTS comments_user_idx
  ON comments (user_id);
