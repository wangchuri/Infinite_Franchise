-- Batch B · Wiki + world create fields
-- Infinite Franchise · infinite_franchise

ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS wiki_background_url TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'worlds_status_check'
  ) THEN
    ALTER TABLE worlds
      ADD CONSTRAINT worlds_status_check
      CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worlds_status_public_idx
  ON worlds (status, visibility, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS wiki_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  category    VARCHAR(32) NOT NULL
              CHECK (category IN (
                'intro','character','location','item',
                'organization','event','concept','other'
              )),
  title       VARCHAR(120) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  aliases     TEXT[] NOT NULL DEFAULT '{}',
  content     TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  status      VARCHAR(16) NOT NULL DEFAULT 'published'
              CHECK (status IN ('draft','pending','published')),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_by  UUID NOT NULL REFERENCES users(id),
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS wiki_entries_world_slug_uidx
  ON wiki_entries (world_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS wiki_entries_world_category_idx
  ON wiki_entries (world_id, category, title);
CREATE INDEX IF NOT EXISTS wiki_entries_world_status_idx
  ON wiki_entries (world_id, status);

CREATE TABLE IF NOT EXISTS timeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id     UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  event_date   VARCHAR(64) NOT NULL DEFAULT '',
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_world_sort_idx
  ON timeline_events (world_id, sort_order);
