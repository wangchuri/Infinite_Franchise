-- Multi-page Wiki layouts: home + per-collection (归属) + custom pages.
-- Backfills the existing single worlds.world_layout as each world's home page.

CREATE TABLE IF NOT EXISTS world_pages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id       UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  kind           VARCHAR(16) NOT NULL DEFAULT 'home'
                 CHECK (kind IN ('home', 'collection', 'custom')),
  collection_key VARCHAR(64),
  title          VARCHAR(120) NOT NULL DEFAULT '',
  slug           VARCHAR(80)  NOT NULL DEFAULT '',
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  blocks         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  theme          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  css            TEXT         NOT NULL DEFAULT '',
  status         VARCHAR(16)  NOT NULL DEFAULT 'published'
                 CHECK (status IN ('draft', 'published')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS world_pages_world_idx
  ON world_pages (world_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS world_pages_home_uidx
  ON world_pages (world_id)
  WHERE kind = 'home' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS world_pages_collection_uidx
  ON world_pages (world_id, collection_key)
  WHERE kind = 'collection' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS world_pages_custom_slug_uidx
  ON world_pages (world_id, slug)
  WHERE kind = 'custom' AND deleted_at IS NULL;

-- Existing layout JSON becomes the home page.
INSERT INTO world_pages (world_id, kind, blocks, theme)
SELECT w.id,
       'home',
       COALESCE(w.world_layout -> 'blocks', '[]'::jsonb),
       COALESCE(w.world_layout -> 'theme', '{}'::jsonb)
FROM worlds w
WHERE w.deleted_at IS NULL
  AND w.world_layout IS NOT NULL
  AND w.world_layout <> '{}'::jsonb
ON CONFLICT DO NOTHING;
