-- Per-world media library (images used by the Wiki editor).

CREATE TABLE IF NOT EXISTS world_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  kind        VARCHAR(16) NOT NULL DEFAULT 'image',
  filename    VARCHAR(200) NOT NULL DEFAULT '',
  size        INTEGER,
  width       INTEGER,
  height      INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_assets_world_idx
  ON world_assets (world_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS world_assets_world_url_uidx
  ON world_assets (world_id, url);
