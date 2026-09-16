-- Page layout revision history (last N per page, pruned on write).

CREATE TABLE IF NOT EXISTS world_page_revisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL REFERENCES world_pages(id) ON DELETE CASCADE,
  world_id    UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  blocks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme       JSONB NOT NULL DEFAULT '{}'::jsonb,
  css         TEXT  NOT NULL DEFAULT '',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_page_revisions_page_idx
  ON world_page_revisions (page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS world_page_revisions_world_idx
  ON world_page_revisions (world_id, created_at DESC);
