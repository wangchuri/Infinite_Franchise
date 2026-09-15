-- World topics: forum-style, persistent threads inside a world.
-- A topic = title + markdown body + status (open/resolved) + pinned + comments.
-- Comments and reactions become polymorphic over 'topic' as well.

CREATE TABLE IF NOT EXISTS world_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  title       VARCHAR(160) NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'resolved')),
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS world_topics_world_created_idx
  ON world_topics (world_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS world_topics_world_status_idx
  ON world_topics (world_id, status)
  WHERE deleted_at IS NULL;

-- Widen the polymorphic target check on comments / reactions to include 'topic'.
-- Drop whatever the check happens to be named, then add a known name.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'comments'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE comments DROP CONSTRAINT %I', c.conname);
  END LOOP;

  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'reactions'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE reactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE comments ADD CONSTRAINT comments_target_type_check
  CHECK (target_type IN ('work', 'entry', 'timeline', 'topic'));
ALTER TABLE reactions ADD CONSTRAINT reactions_target_type_check
  CHECK (target_type IN ('work', 'entry', 'timeline', 'topic'));
